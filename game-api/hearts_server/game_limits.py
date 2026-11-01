"""Per-player creation and unfinished-game limits for this single worker."""

import time
import uuid
from flask import current_app, jsonify, request


class GameLimit(ValueError):
    def __init__(self, message, code="GAME_LIMIT", status=409):
        super().__init__(message)
        self.code, self.status = code, status


def principal(user_id=None):
    if user_id:
        return f"account:{user_id}"
    cookie = current_app.name + "_game_guest"
    key = request.cookies.get(cookie)
    if key and len(key) == 32 and all(c in "0123456789abcdef" for c in key):
        return "guest:" + key
    # Socket clients share their handshake environ until they reconnect.
    key = request.environ.setdefault("games.limit_guest", uuid.uuid4().hex)
    return "guest:" + key


def ensure_capacity(count, *, player=None):
    limit = current_app.config.get("MAX_IN_PROGRESS_GAMES", 20)
    if count >= limit:
        subject = f"{player} has" if player else "You have"
        raise GameLimit(
            f"{subject} {limit} games in progress. Finish or concede one to make room."
        )


def check_creation(key, count=0):
    ensure_capacity(count)
    now = time.monotonic()
    recent = current_app.extensions.setdefault("game_creation_times", {})
    for owner in list(recent):
        recent[owner] = [t for t in recent[owner] if t > now - 60]
        if not recent[owner]:
            del recent[owner]
    times = recent.setdefault(key, [])
    limit = current_app.config.get("GAME_CREATIONS_PER_MINUTE", 5)
    if len(times) >= limit:
        raise GameLimit(
            f"Please wait a minute before creating another game or lobby. You can create up to {limit} per minute.",
            "CREATION_RATE_LIMIT",
            429,
        )
    times.append(now)


def register_limits(app):
    @app.errorhandler(GameLimit)
    def rejected(error):
        response = jsonify(error=str(error), code=error.code)
        if error.status == 429:
            response.headers["Retry-After"] = "60"
        return response, error.status

    @app.after_request
    def guest_cookie(response):
        key = request.environ.get("games.limit_guest")
        if key:
            response.set_cookie(
                app.name + "_game_guest",
                key,
                httponly=True,
                secure=app.config.get("CARDS_PUBLIC_URL", "").startswith("https:"),
                samesite="Lax",
                max_age=365 * 86400,
            )
        return response


def open_games(key):
    import json
    from .models import ActiveGame

    count = 0
    for row in ActiveGame.query:
        data = json.loads(row.state_json)
        if data.get("_closed") or data.get("state", {}).get("game_over"):
            continue
        if row.is_multiplayer:
            mine = any(
                s.get("is_human")
                and not s.get("conceded")
                and (
                    f"account:{s['user_id']}"
                    if s.get("user_id")
                    else s.get("guest_key")
                )
                == key
                for s in data.get("seats", [])
            )
        else:
            mine = (
                f"account:{row.user_id}" if row.user_id else data.get("_guest_key")
            ) == key
        count += bool(mine)
    return count
