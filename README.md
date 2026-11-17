# DataFlow

DataFlow extracts selected fields from PDF, image, and XLSX documents, then lets the account owner review and export the results.

## Current workflow

- Email/password registration and login; existing plaintext password records are upgraded to PBKDF2 hashes after a successful login.
- Optional Google sign-in, when the OAuth client and exact callback URL are configured.
- PDF, JPG, PNG, WebP, and XLSX uploads up to 10 MB. PDFs are counted toward the monthly page limit; an image or workbook counts as one unit.
- Documents are stored in MongoDB GridFS until the user deletes them. PDF and image bytes are sent inline to Gemini only after the uploader checks the consent box. XLSX cells are read on the server and sent to Gemini as text. The Google Files API is not used.
- Users can review extracted fields and export CSV or Excel files. Spreadsheet formula-like values are escaped during export.

Google Sheets export and paid Pro checkout are not enabled yet. The interface labels them unavailable instead of sending users to incomplete endpoints.

## Render deployment

Build command:

    pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build

Start command:

    cd backend && uvicorn server:app --host 0.0.0.0 --port $PORT

The legacy backend.main entry point imports the same API app, so old start commands do not serve a different, API-less application.

Required Render environment variables:

- MONGO_URI: MongoDB connection URI.
- JWT_SECRET: at least 32 random bytes. Generate one in a trusted terminal; never paste it into chat or commit it.
- GEMINI_API_KEY: a Gemini API key. Upload processing returns a clear unavailable response until this is set.

Recommended variables:

- GEMINI_MODEL: defaults to gemini-3.8-flash.
- PUBLIC_APP_URL and FRONTEND_ORIGIN: default to the deployed site URL.
- CORS_ORIGINS: comma-separated exact origins; include localhost only for local development.
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI: configure Google sign-in; register the exact callback URL in Google Cloud.
- REACT_APP_BACKEND_URL: only set this at frontend build time when the API is hosted on a different origin. Leave it unset for the same-origin Render deployment.

Do not commit credentials. This PR removes the .env files from the current branch snapshot, but earlier commits and the existing default-branch history may still contain old copies. Rotate any real credentials and clean the Git history before relying on replacement keys. Put replacements in Render's secret/environment settings, not in source or chat. No .env values were read while preparing this branch.

## Data and privacy notes

The upload consent identifies Google Gemini as the processing provider and records a consent version and timestamp with the document. The original upload remains in MongoDB GridFS until the user deletes it. Google's handling of the inline request is governed by Google's current Gemini API terms; review those terms and publish a project-specific privacy policy before accepting real customer records.
