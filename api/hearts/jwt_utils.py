from functools import wraps
from flask import request, jsonify, g

from hearts.account_access import accounts


def get_user_from_token(token):
    """Validate legacy JWTs, including password-recovery revocation."""
    return accounts().legacy_user(token)


def get_current_user():
    """Accept a shared Cards cookie or a compatible legacy Hearts JWT."""
    user = accounts().cookie_user()
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
