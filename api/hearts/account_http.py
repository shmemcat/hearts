"""HTTP account guards shared by account and game blueprints."""

import json
from flask import abort, current_app, jsonify, request
from hearts.account_access import accounts


def body():
    raw = request.stream.read(16385)
    if len(raw) > 16384:
        abort(413)
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeDecodeError):
        value = None
    return value if isinstance(value, dict) else {}


def csrf_error():
    return (
        jsonify(
            error="Please refresh your account and try again.", code="CSRF_INVALID"
        ),
        403,
    )


def protect_account():
    if not current_app.config.get("CARDS_ACCOUNT_ENABLED"):
        return jsonify(error="Shared accounts are not configured."), 503
    if request.content_length and request.content_length > 16384:
        return jsonify(error="Account request is too large."), 413
    if request.method not in {"GET", "HEAD", "OPTIONS"} and not accounts().valid_csrf():
        return csrf_error()


def no_store(response):
    response.headers["Cache-Control"] = "no-store"
    return response


def protect_cookie_requests():
    if request.method in {"GET", "HEAD", "OPTIONS"} or request.path.startswith(
        "/account/"
    ):
        return None
    if accounts().cookie_user() and not accounts().valid_csrf():
        return csrf_error()
