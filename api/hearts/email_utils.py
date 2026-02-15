import hashlib
import secrets
from datetime import datetime, timedelta

from flask import current_app
from flask_mail import Message

from hearts.extensions import mail


def send_verification_email(email: str, token: str) -> bool:
    """Send email verification link. Returns True if sent, False if mail not configured."""
    base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    link = f"{base_url}/verify-email?token={token}"
    msg = Message(
        subject="Verify your Hearts account",
        recipients=[email],
        body=f"Click to verify your email:\n{link}\n\nLink expires in 24 hours.",
        sender=current_app.config.get("MAIL_DEFAULT_SENDER"),
    )
    try:
        mail.send(msg)
        return True
    except Exception:
        current_app.logger.exception("Failed to send verification email")
        return False


def send_password_reset_email(email: str, token: str) -> bool:
    """Send password reset link. Returns True if sent."""
    base_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    link = f"{base_url}/reset-password?token={token}"
    msg = Message(
        subject="Reset your Hearts password",
        recipients=[email],
        body=f"Click to reset your password:\n{link}\n\nLink expires in 1 hour.",
        sender=current_app.config.get("MAIL_DEFAULT_SENDER"),
    )
    try:
        mail.send(msg)
        return True
    except Exception:
        current_app.logger.exception("Failed to send password reset email")
        return False


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
