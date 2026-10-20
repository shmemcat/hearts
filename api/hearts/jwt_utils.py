import os
import jwt
from functools import wraps
from flask import request, jsonify, g

from hearts.models import User
from hearts.extensions import db


def get_user_from_token(token):
    """Validate legacy JWTs, including password-recovery revocation."""
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = db.session.get(User, int(user_id))
        return user if user and payload.get("av", 0) == user.auth_version else None
    except (jwt.InvalidTokenError, ValueError, TypeError, OverflowError):
        return None


def get_current_user():
    """Accept a shared Cards cookie or a compatible legacy Hearts JWT."""
    from hearts.account_sessions import session_user

    user = session_user()
    if user is None:
        auth = request.headers.get("Authorization", "")
        user = (
            get_user_from_token(auth[7:].strip())
            if auth.startswith("Bearer ")
            else None
        )
    if user:
        g.current_user = user
    return user


def require_jwt(f):
    """Decorator: require valid JWT; return 401 if missing or invalid. Sets g.current_user."""

    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return wrapped
