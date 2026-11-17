import asyncio
import copy
import csv
import datetime
import hashlib
import hmac
import io
import logging
import os
import re
import secrets
import uuid
from pathlib import Path
from urllib.parse import quote

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse, Response, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from openpyxl import Workbook
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError
import jwt
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
from google_auth_oauthlib.flow import Flow

if __package__:
    from .document_processing import MAX_UPLOAD_BYTES, XLSX_MIME, clean_filename, extract_with_gemini, spreadsheet_to_text, validate_upload
    from .security import hash_password, password_needs_rehash, verify_password
else:
    from document_processing import MAX_UPLOAD_BYTES, XLSX_MIME, clean_filename, extract_with_gemini, spreadsheet_to_text, validate_upload
    from security import hash_password, password_needs_rehash, verify_password

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("dataflow")

PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "https://wep-automation.onrender.com").rstrip("/")
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", PUBLIC_APP_URL).rstrip("/")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", f"{PUBLIC_APP_URL}/api/auth/google/callback")
CORS_ORIGINS = [origin.strip().rstrip("/") for origin in os.getenv("CORS_ORIGINS", PUBLIC_APP_URL).split(",") if origin.strip()]
JWT_SECRET = os.getenv("JWT_SECRET", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.8-flash").strip()
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

PRO_PAGES_LIMIT = 2000
FREE_PAGES_LIMIT = 20
CONSENT_VERSION = "2026-10-25"

client = AsyncIOMotorClient(MONGO_URI)
db = client.wep_automation_db
file_bucket = AsyncIOMotorGridFSBucket(db, bucket_name="document_files")
security = HTTPBearer(auto_error=False)

app = FastAPI(title="Wep Automation API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def utcnow() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


def jwt_secret() -> str:
    if len(JWT_SECRET.encode("utf-8")) < 32:
        raise HTTPException(status_code=503, detail="Authentication is not configured. Set a strong JWT_SECRET.")
    return JWT_SECRET


def create_jwt(user_id: str) -> str:
    payload = {"sub": user_id, "iat": utcnow(), "exp": utcnow() + datetime.timedelta(days=7)}
    return jwt.encode(payload, jwt_secret(), algorithm="HS256")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(credentials.credentials, jwt_secret(), algorithms=["HS256"])
        user_id = payload.get("sub")
        user = await db.users.find_one({"user_id": user_id}) if user_id else None
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user
    except HTTPException:
        raise
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


def public_user(user: dict) -> dict:
    hidden = {"_id", "password_hash", "google_credentials", "oauth_tokens"}
    result = {key: value for key, value in user.items() if key not in hidden}
    for key in ("created_at", "updated_at"):
        if isinstance(result.get(key), datetime.datetime):
            result[key] = result[key].isoformat()
    return result


def public_document(document: dict) -> dict:
    hidden = {"_id", "user_id", "file_id", "template_snapshot", "ai_consent_at", "ai_consent_version"}
    result = {key: value for key, value in document.items() if key not in hidden}
    for key in ("created_at", "updated_at"):
        if isinstance(result.get(key), datetime.datetime):
            result[key] = result[key].isoformat()
    return result


PRESET_TEMPLATES = [
    {
        "template_id": "invoice",
        "name_en": "Invoice",
        "name_ar": "فاتورة",
        "icon": "Receipt",
        "fields": [
            {"key": "invoice_number", "label_en": "Invoice number", "label_ar": "رقم الفاتورة", "type": "string", "required": True},
            {"key": "issue_date", "label_en": "Issue date", "label_ar": "تاريخ الإصدار", "type": "date", "required": False},
            {"key": "supplier_name", "label_en": "Supplier", "label_ar": "المورّد", "type": "string", "required": False},
            {"key": "customer_name", "label_en": "Customer", "label_ar": "العميل", "type": "string", "required": False},
            {"key": "subtotal", "label_en": "Subtotal", "label_ar": "المجموع قبل الضريبة", "type": "currency", "required": False},
            {"key": "tax", "label_en": "Tax", "label_ar": "الضريبة", "type": "currency", "required": False},
            {"key": "total", "label_en": "Total", "label_ar": "الإجمالي", "type": "currency", "required": True},
            {"key": "currency", "label_en": "Currency", "label_ar": "العملة", "type": "string", "required": False},
        ],
    },
    {
        "template_id": "receipt",
        "name_en": "Receipt",
        "name_ar": "إيصال",
        "icon": "CreditCard",
        "fields": [
            {"key": "receipt_number", "label_en": "Receipt number", "label_ar": "رقم الإيصال", "type": "string", "required": False},
            {"key": "date", "label_en": "Date", "label_ar": "التاريخ", "type": "date", "required": False},
            {"key": "merchant", "label_en": "Merchant", "label_ar": "التاجر", "type": "string", "required": False},
            {"key": "description", "label_en": "Description", "label_ar": "الوصف", "type": "string", "required": False},
            {"key": "total", "label_en": "Total", "label_ar": "الإجمالي", "type": "currency", "required": True},
            {"key": "currency", "label_en": "Currency", "label_ar": "العملة", "type": "string", "required": False},
        ],
    },
    {
        "template_id": "purchase_order",
        "name_en": "Purchase order",
        "name_ar": "أمر شراء",
        "icon": "ShoppingCart",
        "fields": [
            {"key": "order_number", "label_en": "Order number", "label_ar": "رقم الطلب", "type": "string", "required": True},
            {"key": "order_date", "label_en": "Order date", "label_ar": "تاريخ الطلب", "type": "date", "required": False},
            {"key": "supplier", "label_en": "Supplier", "label_ar": "المورّد", "type": "string", "required": False},
            {"key": "buyer", "label_en": "Buyer", "label_ar": "المشتري", "type": "string", "required": False},
            {"key": "total", "label_en": "Total", "label_ar": "الإجمالي", "type": "currency", "required": True},
        ],
    },
    {
        "template_id": "identity_card",
        "name_en": "Identity card",
        "name_ar": "بطاقة هوية",
        "icon": "FileText",
        "fields": [
            {"key": "full_name", "label_en": "Full name", "label_ar": "الاسم الكامل", "type": "string", "required": True},
            {"key": "id_number", "label_en": "ID number", "label_ar": "رقم الهوية", "type": "string", "required": False},
            {"key": "date_of_birth", "label_en": "Date of birth", "label_ar": "تاريخ الميلاد", "type": "date", "required": False},
            {"key": "expiry_date", "label_en": "Expiry date", "label_ar": "تاريخ الانتهاء", "type": "date", "required": False},
        ],
    },
]
PRESET_BY_ID = {template["template_id"]: template for template in PRESET_TEMPLATES}


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    lang: str = "ar"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class GoogleSessionRequest(BaseModel):
    code: str = Field(min_length=20, max_length=256)


class TemplateFieldInput(BaseModel):
    key: str
    label_en: str = Field(min_length=1, max_length=100)
    label_ar: str = Field(default="", max_length=100)
    type: str = "string"
    required: bool = False


class TemplateCreateRequest(BaseModel):
    name_en: str = Field(min_length=1, max_length=100)
    name_ar: str = Field(min_length=1, max_length=100)
    fields: list[TemplateFieldInput]


class ExtractionUpdateRequest(BaseModel):
    fields: dict


class DocumentIdsRequest(BaseModel):
    document_ids: list[str]


async def send_email(to: str, subject: str, html: str):
    return None


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "timestamp": utcnow().isoformat()}


@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    jwt_secret()
    email = str(req.email).strip().lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    user_id = str(uuid.uuid4())
    now = utcnow()
    user_doc = {
        "user_id": user_id,
        "name": req.name.strip(),
        "email": email,
        "password_hash": hash_password(req.password),
        "plan": "free",
        "pages_limit": FREE_PAGES_LIMIT,
        "pages_used_month": 0,
        "lang": req.lang if req.lang in {"ar", "en"} else "ar",
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    return {"token": create_jwt(user_id), "user": public_user(user_doc)}


@app.post("/api/auth/login")
async def login(req: LoginRequest):
    jwt_secret()
    email = str(req.email).strip().lower()
    user = await db.users.find_one({"email": email})
    stored = user.get("password_hash") if user else None
    if not user or not stored or not verify_password(stored, req.password):
        raise HTTPException(status_code=400, detail="Invalid credentials")
    if password_needs_rehash(stored):
        await db.users.update_one({"user_id": user["user_id"]}, {"$set": {"password_hash": hash_password(req.password)}})
    return {"token": create_jwt(user["user_id"]), "user": public_user(user)}


@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    return {"user": public_user(user)}


@app.post("/api/auth/logout")
async def logout(user=Depends(get_current_user)):
    return {"ok": True}


def _google_flow(state: str | None = None) -> Flow:
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="Google sign-in is not configured")
    client_config = {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }
    flow = Flow.from_client_config(client_config, scopes=["openid", "email", "profile"], state=state)
    flow.redirect_uri = GOOGLE_REDIRECT_URI
    return flow


@app.get("/api/auth/google/start")
async def google_login_start():
    jwt_secret()
    jwt_secret()
    now = utcnow()
    await db.oauth_states.delete_many({"expires_at": {"$lt": now}})
    await db.oauth_login_codes.delete_many({"expires_at": {"$lt": now}})
    flow = _google_flow()
    nonce = secrets.token_urlsafe(24)
    authorization_url, state = flow.authorization_url(
        access_type="online",
        include_granted_scopes="true",
        prompt="select_account",
        nonce=nonce,
    )
    await db.oauth_states.insert_one({
        "state": state,
        "nonce": nonce,
        "purpose": "google_login",
        "expires_at": utcnow() + datetime.timedelta(minutes=10),
    })
    return {"url": authorization_url}


@app.get("/api/auth/google/callback")
async def google_login_callback(state: str, code: str):
    state_doc = await db.oauth_states.find_one_and_delete({"state": state, "purpose": "google_login"})
    if not state_doc or state_doc.get("expires_at", utcnow()) < utcnow():
        raise HTTPException(status_code=400, detail="Google sign-in expired. Please try again.")
    try:
        flow = _google_flow(state=state)
        await asyncio.to_thread(flow.fetch_token, code=code)
        identity = await asyncio.to_thread(
            google_id_token.verify_oauth2_token,
            flow.credentials.id_token,
            GoogleRequest(),
            GOOGLE_CLIENT_ID,
        )
    except Exception as exc:
        logger.warning("Google sign-in verification failed")
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified") from exc
    if not hmac.compare_digest(str(identity.get("nonce", "")), str(state_doc.get("nonce", ""))):
        raise HTTPException(status_code=401, detail="Google sign-in could not be verified")
    email = str(identity.get("email", "")).strip().lower()
    if not email or not identity.get("email_verified"):
        raise HTTPException(status_code=401, detail="Google did not provide a verified email")
    user = await db.users.find_one({"email": email})
    if not user:
        user = {
            "user_id": str(uuid.uuid4()),
            "name": str(identity.get("name") or email.split("@")[0])[:120],
            "email": email,
            "picture": str(identity.get("picture", ""))[:2048],
            "auth_provider": "google",
            "plan": "free",
            "pages_limit": FREE_PAGES_LIMIT,
            "pages_used_month": 0,
            "lang": "ar",
            "created_at": utcnow(),
        }
        try:
            await db.users.insert_one(user)
        except DuplicateKeyError:
            user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(status_code=503, detail="Google account could not be created")
    login_code = secrets.token_urlsafe(32)
    code_hash = hashlib.sha256(login_code.encode("utf-8")).hexdigest()
    await db.oauth_login_codes.insert_one({
        "code_hash": code_hash,
        "user_id": user["user_id"],
        "expires_at": utcnow() + datetime.timedelta(minutes=5),
    })
    return RedirectResponse(f"{FRONTEND_ORIGIN}/auth-callback?code={quote(login_code, safe='')}", status_code=303)


@app.post("/api/auth/google/session")
async def exchange_google_login_code(req: GoogleSessionRequest):
    jwt_secret()
    code_hash = hashlib.sha256(req.code.encode("utf-8")).hexdigest()
    code_doc = await db.oauth_login_codes.find_one_and_delete({"code_hash": code_hash})
    if not code_doc or code_doc.get("expires_at", utcnow()) < utcnow():
        raise HTTPException(status_code=401, detail="Google sign-in expired. Please try again.")
    user = await db.users.find_one({"user_id": code_doc["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return {"token": create_jwt(user["user_id"]), "user": public_user(user)}


@app.get("/api/dashboard/stats")
async def dashboard_stats(user=Depends(get_current_user)):
    user_id = user["user_id"]
    total_docs = await db.documents.count_documents({"user_id": user_id})
    completed = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["completed", "reviewed"]}})
    pending = await db.documents.count_documents({"user_id": user_id, "status": {"$in": ["pending", "processing"]}})
    recent = []
    cursor = db.documents.find({"user_id": user_id}, {"file_id": 0, "ai_consent_at": 0}).sort("created_at", -1).limit(5)
    async for document in cursor:
        recent.append(public_document(document))
    return {
        "total_documents": total_docs,
        "completed": completed,
        "pending": pending,
        "pages_used": user.get("pages_used_month", 0),
        "pages_limit": user.get("pages_limit", PRO_PAGES_LIMIT if user.get("plan") == "pro" else FREE_PAGES_LIMIT),
        "plan": user.get("plan", "free"),
        "recent": recent,
    }


async def get_template_for_user(template_id: str, user_id: str) -> dict:
    if template_id in PRESET_BY_ID:
        return copy.deepcopy(PRESET_BY_ID[template_id])
    template = await db.templates.find_one({"template_id": template_id, "user_id": user_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    template.pop("_id", None)
    template.pop("user_id", None)
    return template


@app.get("/api/templates")
async def get_templates(user=Depends(get_current_user)):
    custom = []
    async for template in db.templates.find({"user_id": user["user_id"]}).sort("created_at", -1):
        template.pop("_id", None)
        template.pop("user_id", None)
        if isinstance(template.get("created_at"), datetime.datetime):
            template["created_at"] = template["created_at"].isoformat()
        custom.append(template)
    return {"presets": copy.deepcopy(PRESET_TEMPLATES), "custom": custom}


@app.post("/api/templates")
async def create_template(req: TemplateCreateRequest, user=Depends(get_current_user)):
    if not 1 <= len(req.fields) <= 40:
        raise HTTPException(status_code=422, detail="A template must contain 1 to 40 fields")
    fields = []
    seen = set()
    allowed_types = {"string", "number", "date", "currency"}
    for field in req.fields:
        key = field.key.strip().lower()
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,39}", key):
            raise HTTPException(status_code=422, detail="Field keys must start with a letter and use only letters, numbers, and underscores")
        if key in seen:
            raise HTTPException(status_code=422, detail="Field keys must be unique")
        if field.type not in allowed_types:
            raise HTTPException(status_code=422, detail="Unsupported field type")
        seen.add(key)
        fields.append({
            "key": key,
            "label_en": field.label_en.strip(),
            "label_ar": field.label_ar.strip(),
            "type": field.type,
            "required": bool(field.required),
        })
    template = {
        "template_id": str(uuid.uuid4()),
        "name_en": req.name_en.strip(),
        "name_ar": req.name_ar.strip(),
        "icon": "FileText",
        "fields": fields,
        "user_id": user["user_id"],
        "is_preset": False,
        "created_at": utcnow(),
    }
    await db.templates.insert_one(template)
    template.pop("_id", None)
    template.pop("user_id", None)
    template["created_at"] = template["created_at"].isoformat()
    return template


@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: str, user=Depends(get_current_user)):
    result = await db.templates.delete_one({"template_id": template_id, "user_id": user["user_id"], "is_preset": {"$ne": True}})
    if result.deleted_count != 1:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"deleted": True}


async def reserve_pages(user_id: str, pages: int) -> bool:
    month = utcnow().strftime("%Y-%m")
    await db.users.update_one({"user_id": user_id, "usage_month": {"$ne": month}}, {"$set": {"usage_month": month, "pages_used_month": 0}})
    await db.users.update_one({"user_id": user_id, "pages_used_month": {"$exists": False}}, {"$set": {"pages_used_month": 0}})
    for _ in range(4):
        user = await db.users.find_one({"user_id": user_id})
        if not user:
            return False
        used = int(user.get("pages_used_month", 0))
        limit = int(user.get("pages_limit", PRO_PAGES_LIMIT if user.get("plan") == "pro" else FREE_PAGES_LIMIT))
        if used + pages > limit:
            return False
        result = await db.users.update_one(
            {"user_id": user_id, "usage_month": month, "pages_used_month": used,
             "$expr": {"$lte": [{"$add": ["$pages_used_month", pages]}, limit]}},
            {"$inc": {"pages_used_month": pages}},
        )
        if result.modified_count == 1:
            return True
    return False


async def release_pages(user_id: str, pages: int) -> None:
    month = utcnow().strftime("%Y-%m")
    await db.users.update_one(
        {"user_id": user_id, "usage_month": month, "pages_used_month": {"$gte": pages}},
        {"$inc": {"pages_used_month": -pages}},
    )


def failure_message(language: str) -> str:
    return "تعذّر استخراج البيانات من هذا المستند. حاول إعادة المعالجة." if language == "ar" else "We couldn't extract this document. Please try reprocessing it."


async def process_document(document_id: str, data: bytes, content_type: str, template: dict, language: str = "ar") -> None:
    await db.documents.update_one({"document_id": document_id}, {"$set": {"status": "processing", "updated_at": utcnow()}})
    try:
        api_key = os.getenv("GEMINI_API_KEY", "").strip()
        if not api_key:
            raise RuntimeError("Gemini API is not configured")
        extraction = await extract_with_gemini(data, content_type, template, api_key, os.getenv("GEMINI_MODEL", GEMINI_MODEL))
        await db.documents.update_one(
            {"document_id": document_id},
            {"$set": {"status": "completed", "extraction": extraction, "error": None, "updated_at": utcnow()}},
        )
    except Exception as exc:
        logger.warning("Document extraction failed: %s", type(exc).__name__)
        await db.documents.update_one(
            {"document_id": document_id},
            {"$set": {"status": "failed", "error": failure_message(language), "updated_at": utcnow()}},
        )


@app.post("/api/documents/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    template_id: str = Form(...),
    consent_to_ai: bool = Form(False),
    language: str = Form("ar"),
    user=Depends(get_current_user),
):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Document extraction is not configured yet. Please try again later.")
    if not consent_to_ai:
        raise HTTPException(status_code=400, detail="Consent is required before sending the file to Google Gemini.")
    template = await get_template_for_user(template_id, user["user_id"])
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        content_type, page_count = validate_upload(file.filename or "document", data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if content_type == XLSX_MIME:
        try:
            spreadsheet_to_text(data)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if not await reserve_pages(user["user_id"], page_count):
        raise HTTPException(status_code=403, detail="Monthly page limit reached")

    document_id = str(uuid.uuid4())
    original_filename = clean_filename(file.filename or "document")
    now = utcnow()
    file_id = None
    document = {
        "document_id": document_id,
        "user_id": user["user_id"],
        "original_filename": original_filename,
        "content_type": content_type,
        "template_id": template["template_id"],
        "template_name_en": template["name_en"],
        "template_name_ar": template["name_ar"],
        "template_snapshot": template,
        "page_count": page_count,
        "status": "pending",
        "extraction": {"detected_language": "", "fields": {}},
        "error": None,
        "consent_to_ai": True,
        "ai_consent_at": now,
        "ai_consent_version": CONSENT_VERSION,
        "language": language if language in {"ar", "en"} else "ar",
        "created_at": now,
        "updated_at": now,
    }
    try:
        file_id = await file_bucket.upload_from_stream(
            original_filename,
            io.BytesIO(data),
            metadata={"document_id": document_id, "user_id": user["user_id"], "content_type": content_type},
        )
        document["file_id"] = file_id
        await db.documents.insert_one(document)
    except Exception as exc:
        if file_id is not None:
            try:
                await file_bucket.delete(file_id)
            except Exception:
                pass
        await release_pages(user["user_id"], page_count)
        logger.error("Document could not be stored: %s", type(exc).__name__)
        raise HTTPException(status_code=503, detail="File storage is temporarily unavailable") from exc
    background_tasks.add_task(process_document, document_id, data, content_type, template, document["language"])
    return {"document": public_document(document)}


@app.get("/api/documents")
async def list_documents(user=Depends(get_current_user)):
    documents = []
    cursor = db.documents.find({"user_id": user["user_id"]}).sort("created_at", -1).limit(100)
    async for document in cursor:
        documents.append(public_document(document))
    return documents


@app.get("/api/documents/{document_id}")
async def get_document(document_id: str, user=Depends(get_current_user)):
    document = await db.documents.find_one({"document_id": document_id, "user_id": user["user_id"]})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    template = document.get("template_snapshot")
    if not template:
        template = await get_template_for_user(document.get("template_id", ""), user["user_id"])
    return {"document": public_document(document), "template": template, "extraction": document.get("extraction", {"fields": {}})}


@app.get("/api/documents/{document_id}/file")
async def get_document_file(document_id: str, user=Depends(get_current_user)):
    document = await db.documents.find_one({"document_id": document_id, "user_id": user["user_id"]})
    if not document or not document.get("file_id"):
        raise HTTPException(status_code=404, detail="Document file not found")
    try:
        grid_out = await file_bucket.open_download_stream(document["file_id"])
        data = await grid_out.read(MAX_UPLOAD_BYTES + 1)
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Document file not found") from exc
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Stored file exceeds the supported size")
    encoded_filename = quote(document.get("original_filename", "document"), safe="")
    return Response(
        content=data,
        media_type=document.get("content_type", "application/octet-stream"),
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_filename}",
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@app.put("/api/documents/{document_id}/extraction")
async def update_extraction(document_id: str, req: ExtractionUpdateRequest, user=Depends(get_current_user)):
    document = await db.documents.find_one({"document_id": document_id, "user_id": user["user_id"]})
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    template = document.get("template_snapshot") or await get_template_for_user(document.get("template_id", ""), user["user_id"])
    allowed_keys = {field["key"] for field in template.get("fields", [])}
    if set(req.fields) - allowed_keys:
        raise HTTPException(status_code=422, detail="The extraction contains fields outside this template")
    fields = {}
    for field in template.get("fields", []):
        key = field["key"]
        raw = req.fields.get(key, {})
        if isinstance(raw, dict):
            value = raw.get("value", "")
            confidence = raw.get("confidence")
            bbox = raw.get("bbox")
        else:
            value, confidence, bbox = raw, None, None
        value = "" if value is None else str(value)[:10_000]
        try:
            confidence = float(confidence) if confidence is not None else None
            if confidence is not None and not 0 <= confidence <= 1:
                confidence = None
        except (TypeError, ValueError):
            confidence = None
        if not isinstance(bbox, list) or len(bbox) != 4 or any(not isinstance(v, (int, float)) or not 0 <= v <= 1000 for v in bbox):
            bbox = None
        fields[key] = {"value": value, "confidence": confidence, "bbox": bbox}
    extraction = {"detected_language": document.get("extraction", {}).get("detected_language", ""), "fields": fields}
    await db.documents.update_one(
        {"document_id": document_id, "user_id": user["user_id"]},
        {"$set": {"extraction": extraction, "status": "reviewed", "error": None, "updated_at": utcnow()}},
    )
    return {"extraction": extraction, "status": "reviewed"}


async def document_bytes(document: dict) -> bytes:
    grid_out = await file_bucket.open_download_stream(document["file_id"])
    data = await grid_out.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError("Stored file exceeds the supported size")
    return data


@app.post("/api/documents_bulk/delete")
async def bulk_delete_documents(req: DocumentIdsRequest, user=Depends(get_current_user)):
    ids = list(dict.fromkeys(req.document_ids))
    if not ids or len(ids) > 100:
        raise HTTPException(status_code=400, detail="Select between 1 and 100 documents")
    documents = await db.documents.find({"user_id": user["user_id"], "document_id": {"$in": ids}}, {"file_id": 1}).to_list(length=100)
    result = await db.documents.delete_many({"user_id": user["user_id"], "document_id": {"$in": ids}})
    for document in documents:
        if document.get("file_id"):
            try:
                await file_bucket.delete(document["file_id"])
            except Exception:
                logger.warning("A deleted document still has a stored file")
    return {"deleted": result.deleted_count}


@app.post("/api/documents_bulk/reprocess")
async def bulk_reprocess_documents(req: DocumentIdsRequest, background_tasks: BackgroundTasks, user=Depends(get_current_user)):
    ids = list(dict.fromkeys(req.document_ids))
    if not ids or len(ids) > 100:
        raise HTTPException(status_code=400, detail="Select between 1 and 100 documents")
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="Document extraction is not configured yet")
    documents = await db.documents.find({"user_id": user["user_id"], "document_id": {"$in": ids}}).to_list(length=100)
    if not documents:
        return {"queued": 0}
    total_pages = sum(int(document.get("page_count", 1)) for document in documents)
    if not await reserve_pages(user["user_id"], total_pages):
        raise HTTPException(status_code=403, detail="Monthly page limit reached")
    queued = 0
    failed_pages = 0
    for document in documents:
        page_count = int(document.get("page_count", 1))
        try:
            data = await document_bytes(document)
            template = document.get("template_snapshot") or await get_template_for_user(document.get("template_id", ""), user["user_id"])
            await db.documents.update_one({"document_id": document["document_id"]}, {"$set": {"status": "pending", "error": None, "updated_at": utcnow()}})
            background_tasks.add_task(process_document, document["document_id"], data, document["content_type"], template, document.get("language", "ar"))
            queued += 1
        except Exception as exc:
            failed_pages += page_count
            logger.warning("A document could not be queued for reprocessing: %s", type(exc).__name__)
    if failed_pages:
        await release_pages(user["user_id"], failed_pages)
    return {"queued": queued}


@app.get("/api/oauth/sheets/status")
async def sheets_status(user=Depends(get_current_user)):
    # Sheets export is intentionally disabled until its OAuth scopes and token storage are configured.
    return {"connected": False, "configured": False}


class ExportRequest(BaseModel):
    document_ids: list[str]


def spreadsheet_safe_value(value) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.lstrip(" \t\r\n").startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r")):
        return "'" + text
    return text


async def export_rows(document_ids: list[str], user_id: str):
    ids = list(dict.fromkeys(document_ids))
    if not ids or len(ids) > 100:
        raise HTTPException(status_code=400, detail="Select between 1 and 100 documents")
    documents = await db.documents.find({"user_id": user_id, "document_id": {"$in": ids}}).sort("created_at", -1).to_list(length=100)
    if not documents:
        raise HTTPException(status_code=404, detail="No matching documents found")
    field_labels = {}
    for document in documents:
        for field in (document.get("template_snapshot") or {}).get("fields", []):
            field_labels.setdefault(field["key"], field.get("label_en") or field["key"])
    headers = ["File name", "Template", "Status", "Created at"] + list(field_labels.keys())
    rows = []
    for document in documents:
        values = [
            document.get("original_filename", ""),
            document.get("template_name_en", ""),
            document.get("status", ""),
            document.get("created_at").isoformat() if isinstance(document.get("created_at"), datetime.datetime) else document.get("created_at", ""),
        ]
        extracted = document.get("extraction", {}).get("fields", {})
        for key in field_labels:
            field = extracted.get(key, "")
            values.append(field.get("value", "") if isinstance(field, dict) else field)
        rows.append([spreadsheet_safe_value(value) for value in values])
    return headers, rows


@app.post("/api/export/csv")
async def export_csv(req: ExportRequest, user=Depends(get_current_user)):
    headers, rows = await export_rows(req.document_ids, user["user_id"])
    output = io.StringIO(newline="")
    writer = csv.writer(output)
    writer.writerow(headers)
    writer.writerows(rows)
    content = output.getvalue().encode("utf-8-sig")
    return StreamingResponse(io.BytesIO(content), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": "attachment; filename=dataflow_export.csv"})


@app.post("/api/export/excel")
async def export_excel(req: ExportRequest, user=Depends(get_current_user)):
    headers, rows = await export_rows(req.document_ids, user["user_id"])
    workbook = Workbook(write_only=True)
    sheet = workbook.create_sheet("Data")
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    output = io.BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=dataflow_export.xlsx"},
    )


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "build"))
    if not os.path.isdir(frontend_dir):
        raise HTTPException(status_code=404, detail="Frontend build folder not found")
    if full_path:
        resolved = os.path.abspath(os.path.join(frontend_dir, full_path))
        if resolved.startswith(frontend_dir + os.sep) and os.path.isfile(resolved):
            return FileResponse(resolved)
    return FileResponse(os.path.join(frontend_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("server:app", host="0.0.0.0", port=port)
