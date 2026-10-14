import os
import uuid
import datetime
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import httpx
import uvicorn
from io import BytesIO
import openpyxl

# Google Sheets
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Stripe
import stripe
import hmac as _hmac

app = FastAPI(title="Wep Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
EMERGENT_EMAIL_KEY = os.getenv("EMERGENT_EMAIL_KEY", "")
stripe.api_key = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
WEBHOOK_CRON_SECRET = os.getenv("WEBHOOK_CRON_SECRET", "")

PRO_PAGES_LIMIT = 2000
FREE_PAGES_LIMIT = 20

client = AsyncIOMotorClient(MONGO_URI)
db = client.wep_automation_db
security = HTTPBearer(auto_error=False)

def create_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

async def send_email(to: str, subject: str, html: str):
    pass

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    lang: str = "en"

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    existing = await db.users.find_one({"email": req.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "user_id": user_id,
        "name": req.name,
        "email": req.email,
        "password_hash": req.password,
        "plan": "free",
        "pages_limit": FREE_PAGES_LIMIT,
        "pages_used_month": 0,
        "created_at": datetime.datetime.utcnow()
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"token": token, "user": user_doc}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email})
    if not user or user.get("password_hash") != req.password:
        raise HTTPException(status_code=400, detail="Invalid credentials")
    token = create_jwt(user["user_id"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"token": token, "user": user}

@app.get("/api/auth/me")
async def get_me(user = Depends(get_current_user)):
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user}

@app.get("/api/dashboard/stats")
async def dashboard_stats(user = Depends(get_current_user)):
    user_id = user["user_id"]
    total_docs = await db.documents.count_documents({"user_id": user_id})
    completed = await db.documents.count_documents({"user_id": user_id, "status": "completed"})
    pending = await db.documents.count_documents({"user_id": user_id, "status": "pending"})
    return {
        "total_documents": total_docs,
        "completed": completed,
        "pending": pending,
        "pages_used": user.get("pages_used_month", 0),
        "plan": user.get("plan", "free")
    }

@app.get("/api/templates")
async def get_templates(user = Depends(get_current_user)):
    presets = []
    async for t in db.templates.find({"is_preset": True}):
        t.pop("_id", None)
        presets.append(t)
    return {"presets": presets, "custom": []}

@app.get("/api/documents")
async def list_documents(user = Depends(get_current_user)):
    docs = []
    cursor = db.documents.find({"user_id": user["user_id"]})
    async for doc in cursor:
        doc.pop("_id", None)
        docs.append(doc)
    return docs

@app.get("/api/oauth/sheets/status")
async def sheets_status(user = Depends(get_current_user)):
    return {"connected": bool(user.get("google_credentials"))}

# ==========================================
# Frontend Static Serving Integration
# ==========================================
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "build"))

if os.path.exists(frontend_dir):
    static_assets_path = os.path.join(frontend_dir, "static")
    if os.path.exists(static_assets_path):
        app.mount("/static", StaticFiles(directory=static_assets_path), name="static")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        file_path = os.path.join(frontend_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dir, "index.html"))

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
