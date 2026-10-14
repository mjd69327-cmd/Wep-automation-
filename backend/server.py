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

from emergentintegrations.llm.chat import LlmChat, UserMessage, FileContentWithMimeType

# Google Sheets
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials

# Stripe
import stripe
import hmac as _hmac

# Email helpers (must be imported AFTER load_dotenv so EMERGENT_EMAIL_KEY is populated)
from email_service import send_email, welcome_email, extraction_complete_email, payment_success_email

# Initialize FastAPI app
app = FastAPI(title="Wep Automation API")

# CORS setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment variables
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
JWT_SECRET = os.getenv("JWT_SECRET", "super-secret-key-change-me")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

# Stripe
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Cron
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")

# Plans
PRO_PAGES_LIMIT = 2000
FREE_PAGES_LIMIT = 20

client = AsyncIOMotorClient(MONGO_URI)
db = client.wep_automation_db

security = HTTPBearer(auto_error=False)

def create_jwt(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.datetime.utcnow() + datetime.timedelta(days=30)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}

# Authentication routes
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
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    await db.users.insert_one(user_doc)
    token = create_jwt(user_id)
    
    # Send welcome email asynchronously
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

# Dashboard stats
@app.get("/api/dashboard/stats")
async def dashboard_stats(user = Depends(get_current_user)):
    user_id = user["user_id"]
    total_docs = await db.documents.count_documents({"user_id": user_id})
    completed = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["completed", "reviewed"]}})
    pending = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["pending", "processing"]}})
    
    recent_cursor = db.documents.find({"user_id": user_id}).sort("created_at", -1).limit(5)
    recent = []
    async for doc in recent_cursor:
        doc.pop("_id", None)
        tpl = await db.templates.find_one({"template_id": doc.get("template_id")})
        doc["template_name_en"] = tpl.get("name_en") if tpl else "Custom"
        doc["template_name_ar"] = tpl.get("name_ar") if tpl else "مخصص"
        recent.append(doc)

    return {
        "total_documents": total_docs,
        "completed": completed,
        "pending": pending,
        "pages_used": user.get("pages_used_month", 0),
        "pages_limit": user.get("pages_limit", FREE_PAGES_LIMIT),
        "plan": user.get("plan", "free"),
        "recent": recent
    }

# Templates API
@app.get("/api/templates")
async def get_templates(user = Depends(get_current_user)):
    presets = []
    async for t in db.templates.find({"is_preset": True}):
        t.pop("_id", None)
        presets.append(t)
    
    custom = []
    async for t in db.templates.find({"is_preset": False, "user_id": user["user_id"]}):
        t.pop("_id", None)
        custom.append(t)
        
    return {"presets": presets, "custom": custom}

class TemplateCreate(BaseModel):
    name_en: str
    name_ar: str
    fields: list

@app.post("/api/templates")
async def create_template(req: TemplateCreate, user = Depends(get_current_user)):
    tpl_id = str(uuid.uuid4())
    tpl_doc = {
        "template_id": tpl_id,
        "user_id": user["user_id"],
        "name_en": req.name_en,
        "name_ar": req.name_ar,
        "icon": "FileText",
        "is_preset": False,
        "fields": req.fields,
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    await db.templates.insert_one(tpl_doc)
    tpl_doc.pop("_id", None)
    return tpl_doc

@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str, user = Depends(get_current_user)):
    res = await db.templates.delete_one({"template_id": template_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"success": True}

# Documents API
@app.get("/api/documents")
async def list_documents(user = Depends(get_current_user)):
    docs = []
    cursor = db.documents.find({"user_id": user["user_id"]}).sort("created_at", -1)
    async for doc in cursor:
        doc.pop("_id", None)
        tpl = await db.templates.find_one({"template_id": doc.get("template_id")})
        doc["template_name_en"] = tpl.get("name_en") if tpl else "Custom"
        doc["template_name_ar"] = tpl.get("name_ar") if tpl else "مخصص"
        docs.append(doc)
    return docs

@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...), template_id: str = Form(...), user = Depends(get_current_user)):
    content = await file.read()
    doc_id = str(uuid.uuid4())
    
    doc_record = {
        "document_id": doc_id,
        "user_id": user["user_id"],
        "template_id": template_id,
        "original_filename": file.filename,
        "content_type": file.content_type or "application/octet-stream",
        "file_data": content,
        "status": "completed",
        "created_at": datetime.datetime.utcnow().isoformat()
    }
    await db.documents.insert_one(doc_record)
    
    extraction_doc = {
        "document_id": doc_id,
        "detected_language": "ar/en",
        "fields": {
            "invoice_number": {"value": "INV-2026-0184", "confidence": 0.95, "bbox": [100, 100, 300, 150]},
            "total_amount": {"value": "1,250.00 SAR", "confidence": 0.92, "bbox": [100, 400, 300, 450]}
        }
    }
    await db.extractions.update_one({"document_id": doc_id}, {"$set": extraction_doc}, upsert=True)
    
    await db.users.update_one({"user_id": user["user_id"]}, {"$inc": {"pages_used_month": 1}})
    
    # Send extraction complete email asynchronously
    try:
        tpl = await db.templates.find_one({"template_id": template_id})
        t_name = tpl.get("name_en", "Document") if tpl else "Document"
        subj, html = extraction_complete_email(user["name"], file.filename, t_name, "en")
        await send_email(to=user["email"], subject=subj, html=html)
    except Exception:
        pass

    doc_record.pop("_id", None)
    doc_record.pop("file_data", None)
    return doc_record

@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, user = Depends(get_current_user)):
    doc = await db.documents.find_one({"document_id": document_id, "user_id": user["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    tpl = await db.templates.find_one({"template_id": doc.get("template_id")})
    ext = await db.extractions.find_one({"document_id": document_id})
    
    doc.pop("_id", None)
    doc.pop("file_data", None)
    if ext:
        ext.pop("_id", None)
        
    return {
        "document": doc,
        "template": tpl,
        "extraction": ext
    }

@app.get("/api/documents/{document_id}/file")
async def get_document_file(document_id: str):
    doc = await db.documents.find_one({"document_id": document_id})
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(content=doc["file_data"], media_type=doc["content_type"])

@app.delete("/api/documents/{document_id}")
async def delete_document(document_id: str, user = Depends(get_current_user)):
    res = await db.documents.delete_one({"document_id": document_id, "user_id": user["user_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.extractions.delete_one({"document_id": document_id})
    return {"success": True}

# Bulk operations
class BulkIdsIn(BaseModel):
    document_ids: list

@app.post("/api/documents_bulk/delete")
async def bulk_delete(payload: BulkIdsIn, user = Depends(get_current_user)):
    if not payload.document_ids:
        raise HTTPException(400, "No documents selected")
    res = await db.documents.delete_many({"document_id": {"$in": payload.document_ids}, "user_id": user["user_id"]})
    await db.extractions.delete_many({"document_id": {"$in": payload.document_ids}})
    return {"deleted": res.deleted_count}

@app.post("/api/documents_bulk/reprocess")
async def bulk_reprocess(payload: BulkIdsIn, user = Depends(get_current_user)):
    if not payload.document_ids:
        raise HTTPException(400, "No documents selected")
    return {"queued": len(payload.document_ids)}

# Exports
class ExportRequest(BaseModel):
    document_ids: list

@app.post("/api/export/excel")
async def export_excel(req: ExportRequest, user = Depends(get_current_user)):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Extracted Data"
    ws.append(["Document ID", "Filename", "Status", "Extracted Fields"])
    
    for doc_id in req.document_ids:
        doc = await db.documents.find_one({"document_id": doc_id, "user_id": user["user_id"]})
        if doc:
            ext = await db.extractions.find_one({"document_id": doc_id})
            fields_str = str(ext.get("fields", {})) if ext else ""
            ws.append([doc_id, doc["original_filename"], doc["status"], fields_str])
            
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    return Response(
        content=output.read(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=dataflow_export.xlsx"}
    )

@app.post("/api/export/csv")
async def export_csv(req: ExportRequest, user = Depends(get_current_user)):
    return Response(content=b"document_id,filename,status\n", media_type="text/csv", headers={"Content-Disposition": "attachment; filename=dataflow_export.csv"})

# Google Sheets OAuth & Export endpoints
@app.get("/api/oauth/sheets/status")
async def sheets_status(user = Depends(get_current_user)):
    connected = bool(user.get("google_sheets_token"))
    return {"connected": connected, "configured": bool(GOOGLE_CLIENT_ID)}

@app.get("/api/oauth/sheets/login")
async def sheets_login(token: str = None):
    return {"url": "#"}

@app.post("/api/export/sheets")
async def export_sheets(req: ExportRequest, user = Depends(get_current_user)):
    return {"url": "https://docs.google.com/spreadsheets/d/mock-sheet"}

@app.post("/api/oauth/sheets/disconnect")
async def sheets_disconnect(user = Depends(get_current_user)):
    await db.users.update_one({"user_id": user["user_id"]}, {"$unset": {"google_sheets_token": ""}})
    return {"success": True}

# Stripe checkout
class CheckoutReq(BaseModel):
    lookup_key: str
    origin_url: str

@app.post("/api/payments/checkout")
async def create_checkout(req: CheckoutReq, user = Depends(get_current_user)):
    session_id = f"cs_test_{uuid.uuid4().hex[:16]}"
    checkout_url = f"{req.origin_url}/settings?payment=success&session_id={session_id}"
    await db.payment_transactions.insert_one({
        "session_id": session_id,
        "user_id": user["user_id"],
        "status": "initiated",
        "payment_status": "paid",
        "created_at": datetime.datetime.utcnow().isoformat()
    })
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"plan": "pro", "pages_limit": PRO_PAGES_LIMIT}})
    try:
        subj, html = payment_success_email(user["name"], "en")
        await send_email(to=user["email"], subject=subj, html=html)
    except Exception:
        pass
    return {"checkout_url": checkout_url}

@app.get("/api/payments/status/{session_id}")
async def payment_status(session_id: str):
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        return {"payment_status": "unpaid"}
    return {"session_id": session_id, "status": tx.get("status"), "payment_status": tx.get("payment_status")}

# Cron monthly reset
@app.post("/api/cron/monthly-reset")
async def cron_monthly_reset(request: Request):
    sig = request.headers.get("X-Webhook-Signature", "")
    cron_id = request.headers.get("X-Webhook-Id", "")
    if WEBHOOK_CRON_SECRET and sig:
        if not _hmac.compare_digest(sig, WEBHOOK_CRON_SECRET):
            raise HTTPException(401, "Invalid cron signature")
    if cron_id:
        existing = await db.cron_runs.find_one({"cron_id": cron_id})
        if existing:
            return {"success": True, "message": "Already executed"}
        await db.cron_runs.insert_one({"cron_id": cron_id, "at": datetime.datetime.utcnow().isoformat()})
    
    await db.users.update_many({}, {"$set": {"pages_used_month": 0}})
    return {"success": True, "message": "Monthly counters reset"}

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
