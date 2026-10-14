# DataFlow Test Credentials

## Email/Password test account
Create fresh via POST /api/auth/register. Example:
- email: `tester@dataflow.app`
- password: `secret123`
- name: `Tester`

Backend endpoints:
- POST /api/auth/register — {email,password,name} returns {token, user}
- POST /api/auth/login — {email,password} returns {token, user}
- GET /api/auth/me — Bearer token or session_token cookie

## Google OAuth (Emergent-managed)
Google OAuth is handled by Emergent Auth; test by setting a cookie manually per the auth testing playbook (/app/auth_testing.md).

## Google Sheets export
Requires GOOGLE_SHEETS_CLIENT_ID / GOOGLE_SHEETS_CLIENT_SECRET env vars (not set — Settings page shows "not configured" state).
