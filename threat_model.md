# Threat Model

## Project Overview

DataFlow is a React frontend with a FastAPI backend, MongoDB storage, JWT authentication, and optional Google sign-in. Users upload financial or identity documents, review extracted fields, and export them. PDF and image contents are sent to Google Gemini after explicit upload consent; XLSX contents are extracted on the server and sent as text.

## Assets

- Account credentials and JWT signing secret.
- Uploaded invoices, receipts, purchase orders, identity documents, and extracted values.
- MongoDB URI, Gemini API key, Google OAuth client secret, and any future payment credentials.
- Monthly usage counters and user-specific templates.

## Trust Boundaries

- Browser to API: requests are untrusted; every private document, template, export, and file route must enforce a valid JWT and owner filter.
- API to MongoDB: credentials and documents are stored in a managed database; files are stored in a dedicated GridFS bucket.
- API to Google Gemini: user document bytes or extracted spreadsheet text leave the application only after upload consent.
- Browser to Google OAuth: login state and nonce must be validated; an exchanged login code is single-use and short-lived.

## Scan Anchors

- API entry point: backend/server.py; alternate entry point backend/main.py imports the same app.
- Password and token helpers: backend/security.py and authentication routes in backend/server.py.
- Upload validation, spreadsheet parsing, prompt, and Gemini request: backend/document_processing.py.
- Main authenticated surfaces: /api/documents, /api/templates, /api/export, /api/dashboard, and /api/auth.
- Frontend upload consent and document preview: frontend/src/pages/UploadPage.jsx and frontend/src/pages/Review.jsx.

## Threat Categories

### Spoofing and elevation of privilege

New passwords must be salted PBKDF2 hashes, legacy plaintext values must be upgraded on successful login, and JWT signing must fail closed without a configured strong secret. Each data query must include the authenticated user ID. Google login must validate the ID token, verified email, state, nonce, and one-time exchange code.

### Information disclosure

Passwords, OAuth tokens, JWTs, uploaded bytes, and provider keys must not appear in logs or API responses. The client must not put JWTs in document URLs. Upload files must be owner-scoped and served only through authenticated routes. Publicly committed environment values must be treated as compromised and rotated.

### Tampering and malicious input

Uploads must be constrained by size, extension, file signatures, and parser limits. XLSX content is untrusted input and must never be executed. Document text must be treated as data, not instructions to the model. User-defined template keys must be validated, extraction output restricted to template keys, and CSV/Excel formula-like values escaped.

### Denial of service and external service abuse

Uploads and reprocessing must respect monthly page limits and include request timeouts. Authentication routes still need production rate limiting before broad public use. BackgroundTasks is an in-process queue; a durable worker queue is needed if processing must survive restarts or handle sustained volume.

### Third-party data transfer

The upload flow must clearly identify Google Gemini and require affirmative consent before sending file bytes or spreadsheet text. Google's processing and retention terms must be reviewed and linked in a project privacy policy before accepting real customer documents.
