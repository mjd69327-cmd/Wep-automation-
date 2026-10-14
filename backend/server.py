import os
import uuid
import datetime
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, UploadFile, File, Form, Request, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
import httpx
import uvicorn
from io import BytesIO
import openpyxl
import csv

# Safe import for emergentintegrations to prevent production crash if not installed
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType
except ImportError:
    LlmChat = None
    UserMessage = None
    FileContentWithMimeType = None

# Google Sheets
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials

# Stripe
import stripe
import hmac as _hmac

# Email helpers
from email_service import send_email, welcome_email, extraction_complete_email, payment_success_email

app = FastAPI(title="Wep Automation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
WEBHOOK_CRON_SECRET = os.getenv("WEBHOOK_CRON_SECRET", "")

PRO_PAGES_LIMIT = 2000
FREE_PAGES_LIMIT = 20

client = AsyncIOMotorClient(MONGO_URI)
db = client.wep_automation_db
security = HTTPBearer(auto_error=False)

def create_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)}
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

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
        "user_id": user_id, "name": req.name, "email": req.email,
        "password_hash": req.password, "plan": "free",
        "pages_limit": FREE_PAGES_LIMIT, "pages_used_month": 0,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    try:
        subj, html = welcome_email(req.name, req.lang)
        await send_email(to=req.email, subject=subj, html=html)
    except Exception:
        pass
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"token": token, "user": user_doc}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = await db.users.find_one({"email": req.email})
    if not user or user.get("password_hash") != req.password:
        raise HTTPException(status_code=400, detail="Invalid email or password")
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
    completed = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["completed", "reviewed"]}})
    pending = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["pending", "processing"]}})
    return {
        "total_documents": total_docs, "completed": completed, "pending": pending,
        "pages_used": user.get("pages_used_month", 0), "pages_limit": user.get("pages_limit", FREE_PAGES_LIMIT),
        "plan": user.get("plan", "free"), "recent": []
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
    cursor = db.documents.find({"user_id": user["user_id"]}).sort("created_at", -1)
    async for doc in cursor:
        doc.pop("_id", None)
        docs.append(doc)
    return docs

@app.get("/api/oauth/sheets/status")
async def sheets_status(user = Depends(get_current_user)):
    return {"connected": bool(user.get("google_sheets_token")), "configured": bool(GOOGLE_CLIENT_ID)}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=True)
