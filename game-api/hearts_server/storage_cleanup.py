"""Retain small completion receipts while pruning retired game snapshots."""

import json
import time
from datetime import datetime, timezone

from sqlalchemy import cast, func, or_

from .extensions import db
from .models import ActiveGame

RETENTION_SECONDS = 24 * 60 * 60
CLEANUP_INTERVAL_SECONDS = 60 * 60


def data_for(row):
    return json.loads(row.state_json) if row else {}


def close_data(data, reason, *, recorded_users=(), now=None):
    data.setdefault("_closed_at", time.time() if now is None else now)
    data.setdefault("_closed", reason)
    data["_recorded_users"] = sorted(
        set(data.get("_recorded_users", [])) | set(recorded_users)
    )
    data.setdefault("state", {})["game_over"] = True
    return data


def evict(game_id):
    from . import game_routes, multiplayer_socket

    game_routes._store.pop(game_id, None)
    multiplayer_socket._runners.pop(game_id, None)


def retire_game(game_id, *, reason="completed", runner=None, recorded_users=()):
    row = ActiveGame.query.filter_by(game_id=game_id).first()
    if row:
        previous = data_for(row)
        data = runner.to_dict() if runner and not previous.get("_closed") else previous
        row.state_json = json.dumps(
            close_data(data, reason, recorded_users=recorded_users)
        )
    evict(game_id)
    db.session.commit()


def compact(data):
    state = data.get("state", {})
    result = {
        key: value
        for key, value in data.items()
        if key
        in {
            "_closed",
            "_closed_at",
            "_recorded_users",
            "_unknown_start",
            "_completion_handled",
            "difficulty",
            "utc_offset_minutes",
            "account_links_version",
            "human_moon_shots",
            "human_hearts_broken",
            "moon_shots",
            "hearts_broken_count",
            "terminated",
        }
    }
    result["state"] = {
        key: value
        for key, value in state.items()
        if key
        in {
            "round",
            "scores",
            "round_scores",
            "game_over",
            "winner_index",
        }
    }
    result["state"]["game_over"] = True
    if "seats" in data:
        result["seats"] = [
            {
                key: seat.get(key)
                for key in ("user_id", "is_human", "conceded", "utc_offset_minutes")
            }
            for seat in data["seats"]
        ]
    result["_storage_pruned"] = True
    return result


def cleanup_closed_games(now=None, *, limit=200, multiplayer_only=False):
    now = time.time() if now is None else now
    cutoff = now - RETENTION_SECONDS
    if db.engine.dialect.name == "postgresql":
        value = cast(ActiveGame.state_json, db.JSON)
        pruned, closed, finished = (
            value["_storage_pruned"].as_boolean(),
            value["_closed"].as_string(),
            value["state"]["game_over"].as_boolean(),
        )
    else:
        pruned = func.json_extract(ActiveGame.state_json, "$._storage_pruned")
        closed = func.json_extract(ActiveGame.state_json, "$._closed")
        finished = func.json_extract(ActiveGame.state_json, "$.state.game_over")
    query = ActiveGame.query.filter(
        pruned.is_not(True),
        or_(closed.is_not(None), finished.is_(True)),
        ActiveGame.updated_at <= datetime.utcfromtimestamp(cutoff),
    )
    if multiplayer_only:
        query = query.filter_by(is_multiplayer=True)
    count = 0
    for row in query.order_by(ActiveGame.updated_at).limit(limit):
        data = data_for(row)
        closed_at = data.get(
            "_closed_at", row.updated_at.replace(tzinfo=timezone.utc).timestamp()
        )
        if closed_at > cutoff:
            continue
        close_data(data, data.get("_closed", "completed"), now=closed_at)
        row.state_json = json.dumps(compact(data))
        evict(row.game_id)
        count += 1
    db.session.commit()
    return {"games_compacted": count}


def register_maintenance(app, socketio):
    from .game_accounts import game_lock
    from .schema import schema_ready

    def run(now=None):
        with app.app_context(), game_lock():
            if not schema_ready():
                return {}
            return cleanup_closed_games(now)

    app.extensions["cleanup_storage"] = run

    def worker():
        while True:
            try:
                run()
            except Exception:
                with app.app_context():
                    db.session.rollback()
                app.logger.exception("Hearts storage cleanup failed")
            socketio.sleep(CLEANUP_INTERVAL_SECONDS)

    if app.config.get("START_STORAGE_CLEANUP", not app.testing):
        socketio.start_background_task(worker)
