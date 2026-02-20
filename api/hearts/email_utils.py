import hashlib
import json
import urllib.request
import urllib.error

from flask import current_app

from hearts.email_templates import verification_email_html, password_reset_email_html

SMTP2GO_API_URL = "https://api.smtp2go.com/v3/email/send"


def _send(to_email: str, subject: str, html_content: str) -> bool:
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
            "sender": f"Hearts <{from_email}>",
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
            current_app.logger.info(
                "SMTP2GO %s for %s: %s",
                resp.status,
                to_email,
                body.get("data", {}).get("succeeded", 0),
            )
            return 200 <= resp.status < 300
    except urllib.error.HTTPError as exc:
        err_body = exc.read().decode(errors="replace") if exc.fp else ""
        current_app.logger.exception(
            "SMTP2GO %s for %s: %s", exc.code, to_email, err_body
        )
        return False
    except Exception:
        current_app.logger.exception("Failed to send email to %s", to_email)
        return False


def send_verification_email(email: str, token: str) -> bool:
    base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    link = f"{base_url}/verify-email?token={token}"
    html = verification_email_html(link)
    return _send(email, "Verify your Hearts account", html)


def send_password_reset_email(email: str, token: str) -> bool:
    base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    link = f"{base_url}/reset-password?token={token}"
    html = password_reset_email_html(link)
    return _send(email, "Reset your Hearts password", html)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
