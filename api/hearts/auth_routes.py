import re
import os
import jwt
import secrets
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timedelta

from hearts.extensions import db, limiter
from hearts.models import User, UserStats, ActiveGame, PasswordResetToken
from hearts.auth_utils import hash_password, verify_password
from hearts.email_utils import send_verification_email, send_password_reset_email, hash_token
from hearts.jwt_utils import get_current_user, require_jwt

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{3,64}$")
MIN_PASSWORD_LEN = 8
AUTH_LIMIT = "5 per minute"
EMAIL_LIMIT = "3 per minute;5 per hour"


def _validate_email(email: str) -> bool:
    return bool(email and EMAIL_RE.match(email.strip()))


def _validate_username(username: str) -> tuple[bool, str]:
    username = (username or "").strip()
    if not username:
        return False, "Username required"
    if not USERNAME_RE.match(username):
        return False, "Username must be 3–64 characters, letters, numbers, and underscores only"
    return True, ""


def _validate_password(password: str) -> tuple[bool, str]:
    if not password or len(password) < MIN_PASSWORD_LEN:
        return False, f"Password must be at least {MIN_PASSWORD_LEN} characters"
    return True, ""


@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute;10 per hour")
def register():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    ok, msg = _validate_username(username)
    if not ok:
        return jsonify({"error": msg}), 400
    if not _validate_email(email):
        return jsonify({"error": "Invalid email"}), 400
    ok, msg = _validate_password(password)
    if not ok:
        return jsonify({"error": msg}), 400

    if User.query.filter_by(username=username).first():
        return jsonify({"error": "Username already taken"}), 409
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    user = User(
        username=username,
        email=email,
        password_hash=hash_password(password),
        email_verified=False,
    )
    user.set_verification_token()
    db.session.add(user)
    db.session.commit()

    send_verification_email(email, user.verification_token)

    return (
        jsonify({
            "user": user.to_dict(),
            "message": "Account created. Check your email to verify your account.",
        }),
        201,
    )


@auth_bp.route("/login", methods=["POST"])
@limiter.limit(AUTH_LIMIT)
def login():
    data = request.get_json() or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 401

    user = User.query.filter_by(username=username).first()
    if not user or not verify_password(password, user.password_hash):
        return jsonify({"error": "Invalid username or password"}), 401

    if not user.email_verified:
        return jsonify({
            "error": "Please verify your email before signing in.",
            "code": "EMAIL_NOT_VERIFIED",
        }), 403

    secret = os.environ.get("JWT_SECRET")
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    token = jwt.encode(payload, secret, algorithm="HS256") if secret else None

    return jsonify({
        "user": user.to_dict(),
        "token": token,
    }), 200


@auth_bp.route("/verify-email", methods=["POST"])
@limiter.limit(AUTH_LIMIT)
def verify_email():
    data = request.get_json() or {}
    token = (data.get("token") or "").strip()
    if not token:
        return jsonify({"error": "Token required"}), 400

    user = User.query.filter_by(
        verification_token=token,
    ).first()
    if not user:
        return jsonify({"error": "Invalid or expired link"}), 400
    if user.verification_expires and user.verification_expires < datetime.utcnow():
        return jsonify({"error": "Verification link expired"}), 400

    user.email_verified = True
    user.verification_token = None
    user.verification_expires = None
    db.session.commit()
    return jsonify({"message": "Email verified", "user": user.to_dict()}), 200


@auth_bp.route("/forgot-password", methods=["POST"])
@limiter.limit(EMAIL_LIMIT)
def forgot_password():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not _validate_email(email):
        return jsonify({"error": "Valid email required"}), 400

    user = User.query.filter_by(email=email).first()
    if user:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_token(raw_token)
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.session.add(reset)
        db.session.commit()
        send_password_reset_email(user.email, raw_token)

    return jsonify({"message": "If that email is registered, we sent a reset link."}), 200


@auth_bp.route("/reset-password", methods=["POST"])
@limiter.limit(AUTH_LIMIT)
def reset_password():
    data = request.get_json() or {}
    token = (data.get("token") or "").strip()
    new_password = data.get("password") or ""

    if not token:
        return jsonify({"error": "Token required"}), 400
    ok, msg = _validate_password(new_password)
    if not ok:
        return jsonify({"error": msg}), 400

    token_hash = hash_token(token)
    reset = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
    if not reset or reset.expires_at < datetime.utcnow():
        return jsonify({"error": "Invalid or expired reset link"}), 400

    user = User.query.get(reset.user_id)
    if not user:
        return jsonify({"error": "Invalid reset link"}), 400

    user.password_hash = hash_password(new_password)
    db.session.delete(reset)
    db.session.commit()
    return jsonify({"message": "Password updated"}), 200


@auth_bp.route("/resend-verification", methods=["POST"])
@limiter.limit(EMAIL_LIMIT)
def resend_verification():
    data = request.get_json() or {}
    email = (data.get("email") or "").strip().lower()
    if not _validate_email(email):
        return jsonify({"error": "Valid email required"}), 400

    user = User.query.filter_by(email=email).first()
    if user and not user.email_verified:
        user.set_verification_token()
        db.session.commit()
        send_verification_email(user.email, user.verification_token)

    return jsonify({"message": "If that email is registered and unverified, we sent a new verification link."}), 200


@auth_bp.route("/me", methods=["GET"])
@require_jwt
def me():
    return jsonify({"user": g.current_user.to_dict()}), 200


@auth_bp.route("/account", methods=["DELETE"])
@require_jwt
@limiter.limit("3 per minute")
def delete_account():
    data = request.get_json() or {}
    password = data.get("password") or ""

    if not password:
        return jsonify({"error": "Password required"}), 400

    user = g.current_user
    if not verify_password(password, user.password_hash):
        return jsonify({"error": "Incorrect password"}), 401

    PasswordResetToken.query.filter_by(user_id=user.id).delete()
    ActiveGame.query.filter_by(user_id=user.id).delete()
    UserStats.query.filter_by(user_id=user.id).delete()
    db.session.delete(user)
    db.session.commit()

    return jsonify({"message": "Account deleted"}), 200
