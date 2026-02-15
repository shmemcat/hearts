import os
import jwt
from functools import wraps
from flask import request, jsonify, g

from hearts.models import User


def get_current_user():
    """Parse JWT from Authorization header and return User or None. Sets g.current_user."""
    auth = request.headers.get("Authorization")
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth[7:].strip()
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        return None
    try:
        payload = jwt.decode(token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
        user = User.query.get(int(user_id))
        if user:
            g.current_user = user
        return user
    except jwt.InvalidTokenError:
        return None


def require_jwt(f):
    """Decorator: require valid JWT; return 401 if missing or invalid. Sets g.current_user."""

    @wraps(f)
    def wrapped(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)

    return wrapped
