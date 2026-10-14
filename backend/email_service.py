"""Email helpers for DataFlow — uses Emergent-managed Resend proxy.
Guardrails: all templates are server-side, no caller-supplied HTML/subject/recipient.
"""
import os
import re
import ipaddress
import logging
import httpx
from html import escape
from html.parser import HTMLParser
from urllib.parse import urlparse
from fastapi import HTTPException

logger = logging.getLogger("dataflow.email")

EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "DataFlow")
EMAIL_REPLY_TO = os.environ.get("EMAIL_REPLY_TO")

_SHORTENERS = ("bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "goo.gl", "rebrand.ly")
_CRED_ASK = (
    "reply with your password", "reply with the code", "send your password", "cvv",
    "send us your password", "enter your password below", "confirm your card number",
    "your full card number", "seed phrase", "recovery phrase", "verify your card",
    "social security number", "confirm your bank details",
)
_HOSTISH = re.compile(r"\b(?:https?://)?((?:[a-z0-9-]+\.)+[a-z]{2,})", re.I)


def _host_ok(host: str) -> bool:
    if not host or "xn--" in host:
        return False
    try:
        ipaddress.ip_address(host)
        return False
    except ValueError:
        pass
    return not any(host == s or host.endswith("." + s) for s in _SHORTENERS)


def _same_site(shown: str, real: str) -> bool:
    return shown == real or real.endswith("." + shown) or shown.endswith("." + real)


class _EmailScan(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags, self.urls, self.anchors = set(), [], []
        self._href, self._text = None, []

    def handle_starttag(self, tag, attrs):
        self.tags.add(tag.lower())
        self.urls += [v for k, v in attrs if k.lower() in ("href", "src") and v]
        if tag.lower() == "a":
            self._href = dict((k.lower(), v) for k, v in attrs).get("href")
            self._text = []

    def handle_data(self, data):
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag):
        if tag.lower() == "a" and self._href is not None:
            self.anchors.append((self._href, "".join(self._text)))
            self._href, self._text = None, []


def _assert_safe_email(subject: str, html: str) -> None:
    scan = _EmailScan()
    scan.feed(html)
    if scan.tags & {"form", "input", "textarea", "select"}:
        raise ValueError("No forms or input fields in email (G2)")
    body = f"{subject}\n{html}".lower()
    for p in _CRED_ASK:
        if p in body:
            raise ValueError(f"Email asks for credentials: {p!r} (G2)")
    for url in scan.urls:
        low = url.strip().lower()
        if low.startswith(("mailto:", "tel:", "cid:", "#")):
            continue
        if not low.startswith("https://"):
            raise ValueError(f"Email links must be absolute https: {url!r} (G3)")
        host = urlparse(low).hostname or ""
        if not _host_ok(host) or urlparse(low).username is not None:
            raise ValueError(f"Shortened/numeric/credentialed URL: {url!r} (G3)")
    for href, text in scan.anchors:
        real = urlparse(href.strip().lower()).hostname or ""
        if not real:
            continue
        for m in _HOSTISH.finditer(text):
            if not _same_site(m.group(1).lower(), real):
                raise ValueError(f"Anchor text {m.group(1)!r} != host {real!r} (G3)")


async def send_email(*, to: str, subject: str, html: str, reply_to: str | None = None) -> str | None:
    if not EMAIL_KEY:
        logger.warning("EMERGENT_EMAIL_KEY not set — skipping email send")
        return None
    _assert_safe_email(subject, html)
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to or EMAIL_REPLY_TO:
        payload["contact_email"] = reply_to or EMAIL_REPLY_TO
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMAIL_KEY},
                json=payload,
            )
        resp.raise_for_status()
        return resp.json().get("id")
    except httpx.HTTPStatusError as e:
        try:
            code = e.response.json().get("code", "")
        except ValueError:
            code = ""
        if code in ("insufficient_credits", "integration_disabled", "daily_limit_reached"):
            logger.warning(f"Email paused: {code} ({e.response.status_code})")
            return None
        logger.error(f"Email send failed: {e.response.status_code} {e.response.text}")
        return None
    except Exception as e:
        logger.error(f"Email send error: {e}")
        return None


# --- Templates (bilingual) ---

def welcome_email(name: str, lang: str = "en") -> tuple[str, str]:
    if lang == "ar":
        subject = f"أهلاً بك في {EMAIL_FROM_NAME} 🎉"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;direction:rtl;text-align:right;">
          <tr><td style="padding:28px 24px;background:#4338CA;color:#fff;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:24px;">أهلاً {escape(name)}!</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">مرحباً بك في {escape(EMAIL_FROM_NAME)}</p>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;color:#111827;">
            <p style="font-size:15px;line-height:1.6;">يسعدنا انضمامك إلينا. حسابك جاهز ويمكنك البدء فوراً:</p>
            <ul style="font-size:14px;line-height:1.8;color:#374151;">
              <li>ارفع فواتيرك وإيصالاتك (PDF أو صور)</li>
              <li>استخراج ذكي بالعربي والإنجليزي</li>
              <li>تصدير مباشر إلى Google Sheets أو Excel</li>
              <li>20 صفحة مجانية شهرياً</li>
            </ul>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">
              هذه الرسالة مرسلة من {escape(EMAIL_FROM_NAME)}. لن نطلب منك كلمة المرور أو تفاصيل البطاقة عبر البريد.
            </p>
          </td></tr>
        </table>
        """
    else:
        subject = f"Welcome to {EMAIL_FROM_NAME} 🎉"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;">
          <tr><td style="padding:28px 24px;background:#4338CA;color:#fff;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:24px;">Welcome, {escape(name)}!</h1>
            <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">Glad to have you at {escape(EMAIL_FROM_NAME)}</p>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;color:#111827;">
            <p style="font-size:15px;line-height:1.6;">Your account is ready. Here is what you can do right away:</p>
            <ul style="font-size:14px;line-height:1.8;color:#374151;">
              <li>Upload invoices and receipts (PDF or images)</li>
              <li>Smart extraction in Arabic and English</li>
              <li>One-click export to Google Sheets or Excel</li>
              <li>20 free pages per month</li>
            </ul>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">
              Sent by {escape(EMAIL_FROM_NAME)}. We will never ask for your password or card details by email.
            </p>
          </td></tr>
        </table>
        """
    return subject, body


def extraction_complete_email(name: str, filename: str, template_name: str, lang: str = "en") -> tuple[str, str]:
    if lang == "ar":
        subject = f"تم استخراج البيانات من {filename}"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;direction:rtl;text-align:right;">
          <tr><td style="padding:24px;background:#0D9488;color:#fff;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;font-size:20px;">✓ المستند جاهز للمراجعة</h2>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;color:#111827;">
            <p style="font-size:15px;line-height:1.6;">مرحباً {escape(name)}،</p>
            <p style="font-size:14px;line-height:1.6;">تم استخراج البيانات من مستندك بنجاح.</p>
            <table role="presentation" style="margin:16px 0;background:#F9FAFB;border-radius:8px;padding:12px 16px;font-size:13px;">
              <tr><td style="color:#6B7280;padding:4px 8px 4px 0;">الملف:</td><td style="font-weight:600;">{escape(filename)}</td></tr>
              <tr><td style="color:#6B7280;padding:4px 8px 4px 0;">القالب:</td><td style="font-weight:600;">{escape(template_name)}</td></tr>
            </table>
            <p style="font-size:14px;color:#374151;">افتح {escape(EMAIL_FROM_NAME)} لمراجعة الحقول وتصديرها.</p>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">
              {escape(EMAIL_FROM_NAME)} — أتمتة إدخال البيانات.
            </p>
          </td></tr>
        </table>
        """
    else:
        subject = f"Your document {filename} is ready"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;">
          <tr><td style="padding:24px;background:#0D9488;color:#fff;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;font-size:20px;">✓ Document ready for review</h2>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;color:#111827;">
            <p style="font-size:15px;line-height:1.6;">Hi {escape(name)},</p>
            <p style="font-size:14px;line-height:1.6;">We finished extracting data from your document.</p>
            <table role="presentation" style="margin:16px 0;background:#F9FAFB;border-radius:8px;padding:12px 16px;font-size:13px;">
              <tr><td style="color:#6B7280;padding:4px 16px 4px 0;">File:</td><td style="font-weight:600;">{escape(filename)}</td></tr>
              <tr><td style="color:#6B7280;padding:4px 16px 4px 0;">Template:</td><td style="font-weight:600;">{escape(template_name)}</td></tr>
            </table>
            <p style="font-size:14px;color:#374151;">Open {escape(EMAIL_FROM_NAME)} to review the fields and export your data.</p>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">
              {escape(EMAIL_FROM_NAME)} — AI data entry automation.
            </p>
          </td></tr>
        </table>
        """
    return subject, body


def payment_success_email(name: str, lang: str = "en") -> tuple[str, str]:
    if lang == "ar":
        subject = f"تمت الترقية إلى {EMAIL_FROM_NAME} Pro"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;direction:rtl;text-align:right;">
          <tr><td style="padding:24px;background:#4338CA;color:#fff;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;">🎉 أصبحت Pro</h2>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;">
            <p style="font-size:15px;">مرحباً {escape(name)}، شكراً لترقيتك إلى {escape(EMAIL_FROM_NAME)} Pro.</p>
            <p style="font-size:14px;color:#374151;">تم رفع حدك الشهري إلى 2,000 صفحة.</p>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">{escape(EMAIL_FROM_NAME)}</p>
          </td></tr>
        </table>
        """
    else:
        subject = f"You are now on {EMAIL_FROM_NAME} Pro"
        body = f"""
        <table role="presentation" width="100%" style="font-family:Arial,sans-serif;">
          <tr><td style="padding:24px;background:#4338CA;color:#fff;border-radius:12px 12px 0 0;">
            <h2 style="margin:0;">🎉 You are now Pro</h2>
          </td></tr>
          <tr><td style="padding:24px;background:#ffffff;">
            <p style="font-size:15px;">Hi {escape(name)}, thanks for upgrading to {escape(EMAIL_FROM_NAME)} Pro.</p>
            <p style="font-size:14px;color:#374151;">Your monthly limit is now 2,000 pages.</p>
            <p style="font-size:12px;color:#6B7280;margin-top:28px;">{escape(EMAIL_FROM_NAME)}</p>
          </td></tr>
        </table>
        """
    return subject, body
