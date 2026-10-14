# DataFlow — Product Requirements Document

## Original Problem Statement
DataFlow — SaaS web platform (Arabic + English) for AI-powered data entry automation. Users upload invoices, receipts, POs and ID cards (PDF/JPG/PNG), extract fields with Gemini 3 Flash, review in a split-view editor, and export to Google Sheets or Excel/CSV. Target market: Arabic (GCC + Egypt) accountants, small shops, SMBs. Launch plan: free tier (20 pages/month), Stripe-ready for Pro.

## User Personas
- **Freelance accountant**: processes dozens of invoices daily, needs fast bulk upload + Google Sheets export.
- **Small shop/restaurant owner**: wants to archive receipts and invoices, simple UI, Arabic-first.
- **Small accounting firm**: needs templates per client, review workflow, export portability.

## Core Requirements (Static)
1. Bilingual UI (Arabic RTL + English LTR) with runtime toggle
2. Email/password + Emergent-managed Google OAuth login
3. Upload PDF/JPG/PNG with drag-and-drop + bulk
4. 4 preset templates (Invoice, Receipt, Purchase Order, ID Card) + custom template builder
5. Gemini 3 Flash extraction with confidence per field + bounding box
6. Split-view review editor with keyboard shortcuts (Tab/Ctrl-Enter)
7. Excel + CSV export (works offline); Google Sheets export (OAuth-gated)
8. Free plan with 20 pages/month usage counter
9. Dashboard with stats + recent activity

## Tech Stack
- **Backend**: FastAPI + MongoDB (motor) + emergentintegrations (Gemini 3 Flash preview) + Google Sheets API + openpyxl
- **Frontend**: React 19 + Tailwind + shadcn/ui + Outfit/Tajawal fonts + sonner + lucide-react
- **Storage**: Emergent Object Storage (via INTEGRATION_PROXY_URL)
- **Auth**: JWT (email) + Emergent Google OAuth session_token (httpOnly cookie)

## What's Been Implemented (2026-02-14 — iteration 2)
### Added in iteration 2
- **Google Sheets OAuth** fully wired with user-provided CLIENT_ID/SECRET; `/api/oauth/sheets/status` now returns `configured: true`.
- **Monthly usage reset** via Emergent platform cron (`.emergent/crons.yml`, `cron: "5 0 1 * *"`); POST `/api/cron/monthly-reset` protected by `WEBHOOK_CRON_SECRET` with idempotency via `X-Webhook-Id`.
- **Resend emails** (Emergent-managed): welcome on registration + extraction-complete notification + Pro-upgrade confirmation. All templates server-side, bilingual (ar/en). Guardrails compliant (no credential asks, https-only links, no forms).
- **Bulk operations** on documents: `POST /api/documents_bulk/delete`, `POST /api/documents_bulk/reprocess` with user-scoped isolation.
- **Stripe Pro subscription** ($19/mo, lookup_key `dataflow_pro_monthly`): `POST /api/payments/checkout` (managed_payments with Stripe-Tax fallback), `GET /api/payments/status/{session_id}` (inline Stripe fallback poll), `POST /api/stripe/webhook` with signature verification. On successful payment: `plan: pro`, `pages_limit: 2000`, confirmation email.
- Frontend: Pro upgrade card in Settings, bulk Reprocess/Delete buttons in Documents, payment success/cancel toasts.

### Testing
- 37/37 backend tests pass (22 regression + 15 new). See `/app/backend/tests/test_dataflow_api.py`.

## What's Been Implemented (2026-02-14 — iteration 1)
### Backend (`/app/backend/server.py`)
- POST /api/auth/register, /api/auth/login, /api/auth/logout
- POST /api/auth/google/session, GET /api/auth/me
- GET/POST/DELETE /api/templates (presets seeded on startup)
- POST /api/documents/upload (multipart) with async BackgroundTask processing
- GET /api/documents, GET /api/documents/{id}, GET /api/documents/{id}/file
- PUT /api/documents/{id}/extraction, POST /api/documents/{id}/reprocess, DELETE
- POST /api/export/excel, POST /api/export/csv
- GET /api/oauth/sheets/status, /login, /callback; POST /api/export/sheets, /disconnect
- GET /api/dashboard/stats
- Gemini 3 Flash extraction with structured JSON fields (value, confidence, bbox)
- Usage counter increments on successful extraction

### Frontend
- Landing page (hero, 6 features, pricing, testimonial-ready footer)
- Login + Register (split hero layout, Google OAuth button, lang toggle)
- Dashboard (stats cards + recent docs + empty state)
- Upload (template picker + dropzone + queue + progress)
- Documents (table + bulk-select + export dropdown + inline actions)
- Review (split-view: document preview + fields with confidence badges + bounding box hover highlight)
- Templates (presets grid + custom builder dialog)
- Settings (account, plan/usage progress, Google Sheets connect/disconnect)
- Full RTL via `html[dir=rtl]` and logical CSS (ms-/me-/ps-/pe-)
- Outfit (headers) + Tajawal (Arabic) + Plus Jakarta Sans (body) via Google Fonts

### Testing
- 22/22 backend endpoints pass automated testing (incl. Gemini extraction pipeline)
- Frontend verified via screenshots: landing, login (RTL), dashboard, upload, templates

## Prioritized Backlog
### P0 (next)
- Add real Google Sheets OAuth credentials to enable export (needs user to provide GOOGLE_SHEETS_CLIENT_ID/SECRET from Google Cloud Console)
- Monthly usage reset cron (currently cumulative)

### P1
- Resend email: send welcome email + extraction-complete notification
- Stripe Pro upgrade flow + webhook
- Bulk reprocess + bulk delete in documents table
- Review page: PDF multi-page navigation + zoom
- Password reset flow

### P2
- Dark mode
- Team/workspace (multi-user)
- Webhook/API for extracted data
- Advanced OCR tuning (per-field prompt hints)
- Multi-page bounding box mapping

## Decisions Made
- Gemini 3 Flash (preview) as primary via Emergent Universal Key; fallback to gemini-2.0-flash
- Emergent-managed Google Auth for login (no separate OAuth app needed)
- Google Sheets export is OAuth-gated per-user (needs admin to configure CLIENT_ID/SECRET)
- Processing is async (BackgroundTask) — no Celery/RQ needed for MVP
- Excel/CSV exports work without any external config
