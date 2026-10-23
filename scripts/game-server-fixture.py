"""Disposable independent Hearts process for the shared-account rehearsal."""

import eventlet

eventlet.monkey_patch()

import json
from pathlib import Path
import re
import sys

from flask import request
from sqlalchemy import event

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root / "game-api"))
from hearts_server import create_app
from hearts_server.extensions import db
from hearts_server.models import ActiveGame, GameResult, UserPreferences, UserStats
from hearts_server.schema import upgrade_schema

database, port, accounts_port, secret = sys.argv[1:]
target = Path(database).resolve()
disposable_root = (root.parent / "cards/.local").resolve()
if (
    target.suffix != ".db"
    or target.parent.parent != disposable_root
    or not target.parent.name.startswith(("euchre-integration-", "hearts-integration-"))
):
    raise RuntimeError("The fixture requires a disposable Cards rehearsal database")
app = create_app(
    {
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///" + str(target),
        "CARDS_PUBLIC_URL": "http://localhost:3000",
        "CORS_ORIGINS": ["http://localhost:3000"],
        "RATELIMIT_ENABLED": False,
        "CARDS_ACCOUNTS_URL": f"http://127.0.0.1:{accounts_port}",
        "CARDS_SERVICE_ID": "hearts-game",
        "CARDS_SERVICE_TOKEN": secret + "-read-hearts",
        "GAME_ACCOUNT_TOKENS": {"hearts": secret + "-hearts"},
    }
)
with app.app_context():
    upgrade_schema()

    @event.listens_for(db.engine, "before_cursor_execute")
    def no_other_service_data(
        connection, cursor, statement, parameters, context, executemany
    ):
        if re.search(
            r'\b(?:FROM|JOIN|UPDATE|INTO)\s+["`]?\b(users|account_sessions|password_reset_tokens|euchre_tables|euchre_game_results)\b',
            statement,
            re.I,
        ):
            raise AssertionError("Hearts runtime accessed another service's data")


provider = app.extensions["accounts"]
original = provider._call


def outside_lock(*args, **kwargs):
    assert app.extensions["game_account_gate"].owner is None
    return original(*args, **kwargs)


provider._call = outside_lock
socketio = app.extensions["socketio"]
socketio.sleep = lambda seconds: eventlet.sleep(
    min(seconds, 0.001) if seconds < 30 else seconds
)


@app.get("/_internal/test/state")
def state():
    if request.headers.get("X-Test-Key") != secret:
        return {"error": "Forbidden"}, 403
    from hearts_server import lobby

    return {
        "solo": ActiveGame.query.filter_by(user_id=42).count(),
        "preferences": UserPreferences.query.filter_by(user_id=42).count(),
        "stats": UserStats.query.filter_by(user_id=42).count(),
        "games": [
            {"game_id": row.game_id, "snapshot": json.loads(row.state_json)}
            for row in ActiveGame.query
        ],
        "results": [
            {"user_id": row.user_id, "difficulty": row.difficulty, "won": row.won}
            for row in GameResult.query
        ],
        "lobbies": [value.to_dict() for value in lobby._lobbies.values()],
    }


socketio.run(
    app, host="127.0.0.1", port=int(port), use_reloader=False, log_output=False
)
