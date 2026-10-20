"""Shared Cards sessions. The cookie contains only an opaque random identifier."""

import hashlib
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlsplit

from flask import current_app, jsonify, request
from hearts.extensions import db
from hearts.models import User


class AccountSession(db.Model):
    __tablename__ = "account_sessions"

    token_hash = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    csrf_token = db.Column(db.String(64), nullable=False)
    credential_hash = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_seen_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False, index=True)


def fingerprint(value):
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def cookie_name():
    return (
        "__Host-cards_session"
        if current_app.config["CARDS_COOKIE_SECURE"]
        else "cards_session"
    )


def current_session():
    if "cards.session" in request.environ:
        return request.environ["cards.session"]
    request.environ["cards.session"] = None
    if not current_app.config.get("CARDS_ACCOUNT_ENABLED"):
        return None
    raw = request.cookies.get(cookie_name(), "")
    if not raw or len(raw) > 128:
        return None
    row = db.session.get(AccountSession, fingerprint(raw))
    now = datetime.utcnow()
    if not row:
        return None
    user = db.session.get(User, row.user_id) if row.user_id else None
    invalid_user = row.user_id and (
        not user
        or not user.email_verified
        or not secrets.compare_digest(
            row.credential_hash or "", fingerprint(user.password_hash)
        )
    )
    if (
        row.expires_at <= now
        or row.last_seen_at < now - timedelta(hours=12)
        or invalid_user
    ):
        db.session.delete(row)
        db.session.commit()
        return None
    if row.last_seen_at < now - timedelta(minutes=1):
        row.last_seen_at = now
        db.session.commit()
    request.environ["cards.session"] = row
    return row


def session_user():
    row = current_session()
    return db.session.get(User, row.user_id) if row and row.user_id else None


def valid_origin():
    origin = request.headers.get("Origin")
    public = urlsplit(current_app.config["CARDS_PUBLIC_URL"])
    allowed = {f"{public.scheme}://{public.netloc}"}
    if public.hostname in {"localhost", "127.0.0.1"}:
        allowed.update(
            f"http://{host}:{port}"
            for host in ("localhost", "127.0.0.1")
            for port in (3000, 3001, 3002)
        )
    return origin in allowed


def valid_csrf(row):
    token = request.headers.get("X-CSRF-Token", "")
    return bool(
        row
        and token
        and valid_origin()
        and secrets.compare_digest(row.csrf_token, token)
    )


def new_session(user=None):
    old = current_session()
    if old:
        db.session.delete(old)
    now = datetime.utcnow()
    AccountSession.query.filter(AccountSession.expires_at <= now).delete(
        synchronize_session=False
    )
    raw = secrets.token_urlsafe(32)
    row = AccountSession(
        token_hash=fingerprint(raw),
        user_id=user.id if user else None,
        csrf_token=secrets.token_urlsafe(32),
        credential_hash=fingerprint(user.password_hash) if user else None,
        created_at=now,
        last_seen_at=now,
        expires_at=now + (timedelta(days=7) if user else timedelta(minutes=30)),
    )
    db.session.add(row)
    db.session.commit()
    request.environ["cards.session"] = row
    return row, raw


def session_response(rotate=False, user=None):
    row = None if rotate else current_session()
    raw = None
    if row is None:
        row, raw = new_session(user)
    user = db.session.get(User, row.user_id) if row.user_id else None
    data = user.to_dict() if user else None
    if data:
        data["id"] = str(data["id"])
    response = jsonify(user=data, csrf_token=row.csrf_token)
    if raw:
        response.set_cookie(
            cookie_name(),
            raw,
            httponly=True,
            secure=current_app.config["CARDS_COOKIE_SECURE"],
            samesite="Lax",
            path="/",
            max_age=7 * 24 * 3600 if user else 1800,
        )
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return response


def protect_cookie_requests():
    """Existing Hearts game/profile APIs also accept the shared cookie and require CSRF."""
    if request.method in {"GET", "HEAD", "OPTIONS"} or request.path.startswith(
        "/account/"
    ):
        return None
    if session_user() and not valid_csrf(current_session()):
        return (
            jsonify(
                error="Please refresh your account and try again.", code="CSRF_INVALID"
            ),
            403,
        )
    return None
