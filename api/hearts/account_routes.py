"""Shared login and email recovery backed by the existing Hearts users table."""

import json
import os
import secrets
from concurrent.futures import ThreadPoolExecutor
from threading import BoundedSemaphore
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode, urlsplit

from flask import Blueprint, abort, current_app, jsonify, request
from sqlalchemy.exc import IntegrityError

from hearts.account_sessions import (
    AccountSession,
    current_session,
    new_session,
    session_response,
    session_user,
    valid_csrf,
)
from hearts.auth_routes import _validate_email, _validate_password, _validate_username
from hearts.auth_routes import VALID_PROFILE_ICONS, delete_user_account
from hearts.auth_utils import hash_password, verify_password
from hearts.email_templates import password_reset_email_html, verification_email_html
from hearts.email_utils import _send, hash_token
from hearts.extensions import db, limiter
from hearts.models import PasswordResetToken, User
from hearts.account_security import change_email, reset_password_with_token

account_bp = Blueprint("cards_account", __name__, url_prefix="/account")
_dummy_password_hash = None
_mail_workers = ThreadPoolExecutor(max_workers=2, thread_name_prefix="cards-mail")
_mail_slots = BoundedSemaphore(32)


def body():
    raw = request.stream.read(16385)
    if len(raw) > 16384:
        abort(413)
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        value = None
    return value if isinstance(value, dict) else {}


def field(data, name):
    value = data.get(name, "")
    return value if isinstance(value, str) else ""


def send_account_email(user, token, kind):
    base = current_app.config["CARDS_PUBLIC_URL"].rstrip("/")
    url = f"{base}/user/?{urlencode({'view': kind, 'token': token})}"
    html = (
        verification_email_html(url)
        if kind == "verify"
        else password_reset_email_html(url)
    )
    html = html.replace("Hearts", "Cards").replace("HEARTS", "CARDS")
    subject = (
        "Verify your Cards account" if kind == "verify" else "Reset your Cards password"
    )
    if current_app.config.get("CARDS_EMAIL_TRANSPORT") == "file":
        if urlsplit(base).hostname not in {"localhost", "127.0.0.1"}:
            raise RuntimeError(
                "File email delivery is only allowed for local development."
            )
        outbox = Path(current_app.config["CARDS_EMAIL_OUTBOX"])
        outbox.mkdir(parents=True, exist_ok=True)
        name = outbox / f"{datetime.utcnow():%Y%m%d-%H%M%S}-{secrets.token_hex(5)}.json"
        # Tokens belong only in the local mail sandbox; never in application logs or API responses.
        descriptor = os.open(str(name), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as mail:
            json.dump(
                {"to": user.email, "subject": subject, "url": url, "html": html}, mail
            )
        return True
    # Keep provider latency out of recovery responses, so email existence cannot
    # be inferred from a slow SMTP request. Bound queued work as well as workers.
    if not _mail_slots.acquire(blocking=False):
        current_app.logger.error("Cards email queue is full; request a new link later.")
        return False
    app, address = current_app._get_current_object(), user.email

    def deliver():
        try:
            with app.app_context():
                _send(address, subject, html, sender_name="Cards")
        finally:
            _mail_slots.release()

    try:
        _mail_workers.submit(deliver)
    except RuntimeError:
        _mail_slots.release()
        app.logger.exception("Unable to queue Cards email")
        return False
    return True


@account_bp.before_request
def protect_account():
    if not current_app.config.get("CARDS_ACCOUNT_ENABLED"):
        return jsonify(error="Shared accounts are not configured."), 503
    if request.content_length and request.content_length > 16384:
        return jsonify(error="Account request is too large."), 413
    if request.method not in {"GET", "HEAD", "OPTIONS"} and not valid_csrf(
        current_session()
    ):
        return (
            jsonify(
                error="Please refresh your account and try again.", code="CSRF_INVALID"
            ),
            403,
        )


@account_bp.after_request
def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@account_bp.get("/session")
@limiter.limit("120 per minute")
def get_session():
    return session_response()


@account_bp.post("/login")
@limiter.limit("10 per minute;60 per hour")
def login():
    global _dummy_password_hash
    data = body()
    username, password = field(data, "username").strip(), field(data, "password")
    if not username or not password or len(username) > 255 or len(password) > 1024:
        return jsonify(error="Check your username or email and password."), 401
    user = User.query.filter_by(username=username).first()
    if user is None and _validate_email(username):
        user = User.query.filter_by(email=username.lower()).first()
    if _dummy_password_hash is None:
        _dummy_password_hash = hash_password(secrets.token_urlsafe(32))
    try:
        correct = verify_password(
            password, user.password_hash if user else _dummy_password_hash
        )
    except Exception:
        correct = False
    if not user or not correct:
        return jsonify(error="Check your username or email and password."), 401
    if not user.email_verified:
        return (
            jsonify(
                error="Verify your email before signing in.", code="EMAIL_NOT_VERIFIED"
            ),
            403,
        )
    return session_response(rotate=True, user=user)


@account_bp.post("/logout")
def logout():
    return session_response(rotate=True)


@account_bp.post("/profile")
@limiter.limit("30 per minute")
def update_account_profile():
    user = session_user()
    if not user:
        return jsonify(error="Sign in to customize your profile."), 401
    data = body()
    if not any(key in data for key in ("profile_icon", "email")):
        return jsonify(error="No changes provided."), 400
    icon = field(data, "profile_icon").strip()
    if "profile_icon" in data and icon not in VALID_PROFILE_ICONS:
        return jsonify(error="Choose a valid profile icon."), 400
    email = field(data, "email").strip().lower()
    if "email" in data and (len(email) > 255 or not _validate_email(email)):
        return jsonify(error="Enter a valid email address."), 400
    if "email" in data:
        existing = User.query.filter_by(email=email).first()
        if existing and existing.id != user.id:
            return jsonify(error="That email is already registered."), 409
    email_changed = "email" in data and email != user.email
    if "profile_icon" in data:
        user.profile_icon = icon
    token = None
    if email_changed:
        current = current_session()
        token = change_email(user, email, keep_session=current.token_hash)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="That email is already registered."), 409
    if token:
        send_account_email(user, token, "verify")
    response = session_response(rotate=email_changed)
    payload = response.get_json()
    payload["message"] = (
        "Verification email sent. Verify your new address, then sign in again."
        if email_changed
        else "Profile saved."
    )
    response.set_data(current_app.json.dumps(payload))
    return response


@account_bp.post("/delete")
@limiter.limit("3 per minute")
def delete_shared_account():
    if not session_user():
        return jsonify(error="Sign in to delete your account."), 401
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = {}
    password = field(data, "password")
    if not password or len(password) > 1024:
        return jsonify(error="Please enter your password."), 400
    # Reuse Hearts' password confirmation and deletion of account-owned data.
    response = current_app.make_response(delete_user_account(session_user(), password))
    if response.status_code != 200:
        return response
    request.environ["cards.session"] = None
    return session_response(rotate=True)


@account_bp.post("/register")
@limiter.limit("5 per minute;10 per hour")
def register():
    data = body()
    username, email, password = (
        field(data, "username").strip(),
        field(data, "email").strip().lower(),
        field(data, "password"),
    )
    ok, error = _validate_username(username)
    if not ok:
        return jsonify(error=error), 400
    if not _validate_email(email) or len(email) > 255:
        return jsonify(error="Enter a valid email address."), 400
    ok, error = _validate_password(password)
    if not ok or len(password) > 1024:
        return jsonify(error=error or "Password is too long."), 400
    token = secrets.token_urlsafe(32)
    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        email_verified=False,
        verification_token=hash_token(token),
        verification_expires=datetime.utcnow() + timedelta(hours=24),
    )
    try:
        db.session.add(user)
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="That username or email is already registered."), 409
    send_account_email(user, token, "verify")
    return jsonify(message="Check your email to verify your account."), 201


@account_bp.post("/verify-email")
@limiter.limit("10 per minute")
def verify_email():
    token = field(body(), "token").strip()
    if not token or len(token) > 256:
        return jsonify(error="This verification link is invalid or expired."), 400
    # Also accept existing Hearts verification links during the account transition.
    user = (
        User.query.filter(User.verification_token.in_([hash_token(token), token]))
        .with_for_update(of=User)
        .first()
    )
    if (
        not user
        or not user.verification_expires
        or user.verification_expires <= datetime.utcnow()
    ):
        return jsonify(error="This verification link is invalid or expired."), 400
    user.email_verified, user.verification_token, user.verification_expires = (
        True,
        None,
        None,
    )
    db.session.commit()
    return jsonify(message="Email verified. You can sign in now.")


@account_bp.post("/resend-verification")
@limiter.limit("3 per minute;5 per hour")
def resend_verification():
    email = field(body(), "email").strip().lower()
    if not _validate_email(email) or len(email) > 255:
        return jsonify(error="Enter a valid email address."), 400
    user = User.query.filter_by(email=email).first()
    if user and not user.email_verified:
        token = secrets.token_urlsafe(32)
        user.verification_token, user.verification_expires = hash_token(
            token
        ), datetime.utcnow() + timedelta(hours=24)
        db.session.commit()
        send_account_email(user, token, "verify")
    return jsonify(
        message="If that account needs verification, a new link has been sent."
    )


@account_bp.post("/forgot-password")
@limiter.limit("3 per minute;5 per hour")
def forgot_password():
    email = field(body(), "email").strip().lower()
    if not _validate_email(email) or len(email) > 255:
        return jsonify(error="Enter a valid email address."), 400
    user = User.query.filter_by(email=email).first()
    if user:
        token = secrets.token_urlsafe(32)
        # Keep previous requests valid until one reset is completed, avoiding reset-link denial of service.
        db.session.add(
            PasswordResetToken(
                user_id=user.id,
                token_hash=hash_token(token),
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
        )
        db.session.commit()
        send_account_email(user, token, "reset")
    return jsonify(
        message="If that email is registered, a password reset link has been sent."
    )


@account_bp.post("/reset-password")
@limiter.limit("10 per minute;60 per hour")
def reset_password():
    data = body()
    token, password = field(data, "token").strip(), field(data, "password")
    ok, error = _validate_password(password)
    if not ok or len(password) > 1024:
        return jsonify(error=error or "Password is too long."), 400
    if not token or len(token) > 256:
        return jsonify(error="This reset link is invalid or expired."), 400
    if not reset_password_with_token(token, password):
        return jsonify(error="This reset link is invalid or expired."), 400
    return jsonify(message="Password updated. Sign in with your new password.")
