import hashlib
import json
import urllib.request
import urllib.error
from urllib.parse import urlencode

from flask import current_app

from hearts.email_templates import verification_email_html, password_reset_email_html

SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send"


def _send(
    to_email: str, subject: str, html_content: str, sender_name: str = "Cards"
) -> bool:
    """Send an email via SMTP2GO REST API. Returns True on success."""
    api_key = current_app.config.get("SMTP2GO_API_KEY")
    from_email = current_app.config.get("SMTP2GO_FROM_EMAIL", "noreply@shmem.dev")

    if not api_key:
        current_app.logger.warning("SMTP2GO_API_KEY not set; skipping email send")
        return False

    payload = json.dumps(
        {
            "api_key": api_key,
            "to": [to_email],
            "sender": f"{sender_name} <{from_email}>",
            "subject": subject,
            "html_body": html_content,
        }
    ).encode()

    req = urllib.request.Request(
        SMTP2GO_API_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read())
            result = body.get("data", {})
            success = (
                200 <= resp.status < 300
                and result.get("succeeded") == 1
                and result.get("failed", 0) == 0
                and not result.get("failures")
                and not result.get("error")
            )
            current_app.logger.info(
                "SMTP2GO %s for %s: %s",
                resp.status,
                to_email,
                result.get("succeeded", 0),
            )
            if not success:
                # Do not log provider response bodies: they can echo private links.
                current_app.logger.error(
                    "SMTP2GO rejected an email (request_id=%s)",
                    body.get("request_id", "unknown"),
                )
            return success
    except urllib.error.HTTPError as exc:
        current_app.logger.error("SMTP2GO HTTP error %s", exc.code)
        return False
    except Exception:
        current_app.logger.exception("Failed to send email to %s", to_email)
        return False


def send_verification_email(email: str, token: str) -> bool:
    cards = current_app.config.get("CARDS_PUBLIC_URL")
    if cards:
        link = f"{cards}/user/?{urlencode({'view': 'verify', 'token': token})}"
    else:
        base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
        link = f"{base_url}/verify-email?{urlencode({'token': token})}"
    html = verification_email_html(link)
    return _send(email, "Verify your Cards account", html, sender_name="Cards")


def send_password_reset_email(email: str, token: str) -> bool:
    cards = current_app.config.get("CARDS_PUBLIC_URL")
    if cards:
        link = f"{cards}/user/?{urlencode({'view': 'reset', 'token': token})}"
    else:
        base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
        link = f"{base_url}/reset-password?{urlencode({'token': token})}"
    html = password_reset_email_html(link)
    return _send(email, "Reset your Cards password", html, sender_name="Cards")


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
