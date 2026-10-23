"""Game-owned account cleanup and write exclusion for the single game worker.

The receipt tables use separate metadata so the pinned legacy bootstrap remains
unchanged. Provision them explicitly before enabling the remote account client.
"""

from contextlib import nullcontext
from datetime import datetime
from functools import wraps
import json
import secrets
import uuid
from eventlet.semaphore import Semaphore
from greenlet import getcurrent
from flask import Blueprint, current_app, g, jsonify, request
from flask_socketio import emit
from sqlalchemy import (
    Column,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    select,
)
from sqlalchemy.exc import SQLAlchemyError
from hearts_server.extensions import db
from hearts_server.account_contracts import AccountsUnavailable
from hearts_server.schema import schema_ready

metadata = MetaData()
receipts = {}
versions = {}
for game in ("hearts",):
    receipts[game] = Table(
        game + "_account_deletions",
        metadata,
        Column("user_id", Integer, primary_key=True),
        Column("request_id", String(32), nullable=False),
        Column("deleted_at", DateTime, nullable=False),
    )
    versions[game] = Table(
        game + "_account_schema_version",
        metadata,
        Column("version", String(32), primary_key=True),
    )


class GameGate:
    """Greenlet-aware reentrant gate; never held during identity validation."""

    def __init__(self):
        self.lock, self.owner, self.depth = (Semaphore(), None, 0)

    def __enter__(self):
        actor = getcurrent()
        if self.owner is actor:
            self.depth += 1
        else:
            self.lock.acquire()
            self.owner, self.depth = (actor, 1)
        return self

    def __exit__(self, *args):
        self.depth -= 1
        if not self.depth:
            self.owner = None
            self.lock.release()


def game_lock():
    return current_app.extensions.get("game_account_gate", nullcontext())


def accounts_available(user_id):
    if not user_id or not current_app.extensions.get("remote_accounts_enabled"):
        return True
    from hearts_server.account_access import accounts

    try:
        accounts().public_profiles([user_id])
        return True
    except AccountsUnavailable:
        return False


def games_for_app():
    return ("hearts",)


def is_deleted(user_id, game=None):
    if not current_app.extensions.get("remote_accounts_enabled") or not user_id:
        return False
    return any(
        (
            db.session.execute(
                select(receipts[name].c.user_id).where(
                    receipts[name].c.user_id == user_id
                )
            ).first()
            for name in ((game,) if game else games_for_app())
        )
    )


def _legacy_games():
    from hearts_server.models import ActiveGame

    return any(
        (
            json.loads(row.state_json).get("account_links_version", 0) < 1
            for row in ActiveGame.query.filter_by(is_multiplayer=True)
        )
    )


def _receipt(game, user_id, request_id):
    if not db.session.execute(
        select(receipts[game].c.user_id).where(receipts[game].c.user_id == user_id)
    ).first():
        db.session.execute(
            receipts[game]
            .insert()
            .values(
                user_id=user_id, request_id=request_id, deleted_at=datetime.utcnow()
            )
        )


def _cleanup_hearts(user_id):
    from hearts_server.models import (
        ActiveGame,
        UserStats,
        DifficultyStats,
        UserPreferences,
        GameResult,
    )
    from hearts_server import (
        game_routes,
        game_socket,
        lobby,
        lobby_socket,
        multiplayer_socket as mp,
    )
    from hearts_server.stats_routes import _recorded_games

    if _legacy_games():
        return False
    socketio = current_app.extensions["socketio"]
    solo_ids = [row.game_id for row in ActiveGame.query.filter_by(user_id=user_id)]
    for game_id in solo_ids:
        game_routes._store.pop(game_id, None)
    for sid, game_id in list(game_socket._sid_to_game_id.items()):
        if game_id in solo_ids:
            game_socket._sid_to_game_id.pop(sid, None)
            game_socket._sid_to_icon.pop(sid, None)
            socketio.server.disconnect(sid, namespace="/game")
    rows = {row.game_id: row for row in ActiveGame.query.filter_by(is_multiplayer=True)}
    for game_id in set(rows) | set(mp._runners) | set(mp._game_auth):
        row = rows.get(game_id)
        runner = mp._runners.get(game_id)
        if runner is None:
            if row is None:
                for seat_index, uid in list(mp._game_auth.get(game_id, {}).items()):
                    if uid == user_id:
                        mp._game_auth[game_id].pop(seat_index, None)
                continue
            from hearts_server.multiplayer_runner import MultiplayerRunner

            runner = MultiplayerRunner.from_json(row.state_json)
        changed = False
        for index, seat in enumerate(runner.seats):
            if (
                seat.user_id != user_id
                and mp._game_auth.get(game_id, {}).get(index) != user_id
            ):
                continue
            token = seat.player_token
            if runner.is_active_human(index):
                runner.concede_player(index)
            seat.name, seat.icon, seat.user_id = (f"Bot {index + 1}", "robot", None)
            seat.is_human, seat.conceded, seat.player_token = (False, True, None)
            mp._game_auth.get(game_id, {}).pop(index, None)
            mp._cancel_idle_timer(game_id, index)
            if token:
                timer = mp._disconnect_timers.pop(token, None)
                if timer:
                    timer.cancel()
                sid = mp._token_to_sid.pop(token, None)
                if sid:
                    mp._sid_to_game.pop(sid, None)
                    socketio.server.disconnect(sid, namespace="/multi")
            changed = True
        if changed:
            if row is not None:
                row.state_json = runner.to_json()
            if game_id in mp._runners:
                mp._runners[game_id] = runner
                request.environ.setdefault("hearts.cleaned_games", set()).add(game_id)
    for value in list(lobby._lobbies.values()):
        for index, seat in enumerate(value.seats):
            if seat and seat.user_id == user_id:
                token, sid = (seat.player_token, seat.sid)
                lobby.cancel_disconnect_timer(value, token)
                value.player_tokens.pop(token, None)
                value.seats[index] = None
                if sid:
                    lobby_socket._sid_to_lobby.pop(sid, None)
                    socketio.server.disconnect(sid, namespace="/lobby")
                if value.host_token == token:
                    if lobby.migrate_host(value.code) is None:
                        value.host_token = uuid.uuid4().hex
                request.environ.setdefault("hearts.cleaned_lobbies", set()).add(
                    value.code
                )
    for key in list(_recorded_games):
        if str(key).startswith(str(user_id) + ":"):
            _recorded_games.discard(key)
    for model in (ActiveGame, UserStats, DifficultyStats, UserPreferences, GameResult):
        model.query.filter_by(user_id=user_id).delete(synchronize_session=False)
    return True


def resume_cleaned_games(app, game_ids):
    """Publish committed cleanup and resume bots without delaying the account ACK."""
    from hearts_server import multiplayer_socket as mp
    from hearts_server.multiplayer_game_ops import advance_if_bot_turn

    with app.app_context(), game_lock():
        socketio = app.extensions["socketio"]
        for game_id in game_ids:
            runner = mp._runners.get(game_id)
            if runner is None:
                continue
            mp._emit_state_to_all(game_id, runner, socketio)
            if runner.state.game_over:
                socketio.emit(
                    "game_terminated", {}, room=mp._room(game_id), namespace="/multi"
                )
                mp._cancel_all_idle_timers(game_id)
                mp._delete_game(game_id)
                mp._game_auth.pop(game_id, None)
            else:
                advance_if_bot_turn(game_id, runner, mp._build_ops(socketio, app))


def register_private_game_api(app):
    blueprint = Blueprint(
        "private_game_accounts", __name__, url_prefix="/_internal/games/v1"
    )

    @blueprint.post("/<game>/<operation>")
    def dispatch(game, operation):
        if (
            game not in games_for_app()
            or operation not in {"preferences", "delete-user"}
            or (operation == "preferences" and game != "hearts")
        ):
            return (jsonify(error="Not found"), 404)
        expected = app.config["GAME_ACCOUNT_TOKENS"].get(game, "")
        token = request.headers.get("Authorization", "")
        if (
            request.headers.get("X-Cards-Service") != "accounts"
            or not expected
            or len(token) > 1024
            or (not token.startswith("Bearer "))
            or (not secrets.compare_digest(token[7:], expected))
        ):
            return (jsonify(error="Unauthorized"), 401)
        from hearts_server.account_http import body

        data = body()
        user_id = data.get("user_id")
        if type(user_id) is not int or not 0 < user_id < 2**63:
            return (jsonify(error="Invalid user ID"), 400)
        with game_lock():
            if operation == "preferences":
                from hearts_server.models import UserPreferences

                row = (
                    None
                    if is_deleted(user_id)
                    else UserPreferences.query.filter_by(user_id=user_id).first()
                )
                return jsonify(version=1, preferences=row.to_dict() if row else None)
            request_id = data.get("request_id")
            if (
                not isinstance(request_id, str)
                or len(request_id) != 32
                or any((c not in "0123456789abcdef" for c in request_id))
            ):
                return (jsonify(error="Invalid request ID"), 400)
            if not is_deleted(user_id, game):
                try:
                    complete = _cleanup_hearts(user_id)
                    if not complete:
                        db.session.rollback()
                        return (
                            jsonify(version=1, deleted=False, request_id=request_id),
                            202,
                        )
                    _receipt(game, user_id, request_id)
                    db.session.commit()
                    from hearts_server.lobby import get_lobby

                    for code in request.environ.pop("hearts.cleaned_lobbies", set()):
                        lobby = get_lobby(code)
                        if lobby:
                            app.extensions["socketio"].emit(
                                "lobby_update",
                                lobby.to_dict(),
                                room=f"lobby:{code}",
                                namespace="/lobby",
                            )
                    changed = request.environ.pop("hearts.cleaned_games", set())
                    if changed:
                        app.extensions["socketio"].start_background_task(
                            resume_cleaned_games, app, changed
                        )
                except (SQLAlchemyError, ValueError, KeyError, TypeError):
                    db.session.rollback()
                    return (jsonify(error="Cleanup will retry"), 503)
            return jsonify(version=1, deleted=True, request_id=request_id)

    @blueprint.after_request
    def no_store(response):
        response.headers["Cache-Control"] = "no-store"
        return response

    app.register_blueprint(blueprint)


def _prime_identity():
    from hearts_server.account_access import accounts

    port = accounts()
    request.environ.pop("cards.account_event_primed", None)
    port.refresh()
    user = port.cookie_user()
    token = request.headers.get("Authorization", "")
    if not user and token.startswith("Bearer "):
        user = port.legacy_user(token[7:].strip())
    if not user and request.args.get("auth_token"):
        user = port.legacy_user(request.args["auth_token"])
    request.environ["cards.account_event_primed"] = True
    if user:
        g.current_user = user
    return user


def install_remote_runtime(app):
    app.extensions["game_account_gate"] = GameGate()
    app.extensions["remote_accounts_enabled"] = True
    app.extensions["game_socket_identities"] = {}
    with app.app_context():
        if db.engine.dialect.name == "sqlite":
            from sqlalchemy import event

            @event.listens_for(db.engine, "connect")
            def foreign_keys(connection, record):
                connection.execute("PRAGMA foreign_keys=ON")

    register_private_game_api(app)

    @app.before_request
    def prepare_game_request():
        if request.path.startswith("/_internal/") or request.endpoint in {
            "health",
            "ready",
        }:
            return None
        if not schema_ready():
            return (jsonify(error="Game account integration is not ready."), 503)
        db.session.rollback()
        user = _prime_identity()
        if (
            request.blueprint
            in {
                "games",
                "stats",
                "prefs",
                "lobbies",
            }
            or request.endpoint == "leaderboard.reset_month"
        ):
            gate = app.extensions["game_account_gate"]
            gate.__enter__()
            request.environ["cards.game_gate"] = gate
            if user and is_deleted(user.id):
                return (jsonify(error="Your account is no longer available."), 401)

    @app.teardown_request
    def finish_game_request(error):
        gate = request.environ.pop("cards.game_gate", None)
        if gate:
            gate.__exit__(None, None, None)
        request.environ.pop("cards.account_event_primed", None)
        request.environ.pop("cards.remote_accounts", None)


def install_socket_dispatch(socketio):
    original = socketio.on

    def on(event, namespace=None, **options):
        decorate = original(event, namespace=namespace, **options)

        def register(handler):

            @wraps(handler)
            def wrapped(*args, **kwargs):
                identities = current_app.extensions["game_socket_identities"]
                identity_key = (namespace, request.sid)
                if event == "disconnect":
                    with game_lock():
                        identities.pop(identity_key, None)
                        return handler(*args, **kwargs)
                try:
                    if not schema_ready():
                        return (
                            False
                            if event == "connect"
                            else {"ok": False, "error": "Game service is not ready."}
                        )
                    db.session.rollback()
                    known_guest = (
                        event != "connect"
                        and identity_key in identities
                        and (identities[identity_key] is None)
                    )
                    if known_guest:
                        request.environ["cards.remote_accounts"] = {
                            "session": {
                                "user": None,
                                "session": None,
                                "valid_origin": False,
                                "valid_csrf": False,
                            }
                        }
                        request.environ["cards.account_event_primed"] = True
                    user = None if known_guest else _prime_identity()
                    if event == "connect" and namespace == "/game":
                        from hearts_server.models import ActiveGame
                        from hearts_server.account_access import accounts

                        row = ActiveGame.query.filter_by(
                            game_id=request.args.get("game_id")
                        ).first()
                        if row and row.user_id:
                            request.environ["cards.game_icon"] = (
                                accounts()
                                .public_profiles([row.user_id])
                                .get(row.user_id)
                            )
                    db.session.rollback()
                    with game_lock():
                        if user and is_deleted(user.id):
                            return (
                                False
                                if event == "connect"
                                else {
                                    "ok": False,
                                    "error": "Your account is no longer available.",
                                }
                            )
                        expected = identities.get(identity_key)
                        if (
                            event != "connect"
                            and expected
                            and (not user or user.id != expected)
                        ):
                            message = "Your account changed. Sign in again to rejoin this game."
                            if namespace in {"/game", "/lobby", "/multi"}:
                                emit("error", {"message": message}, namespace=namespace)
                            return {"ok": False, "error": message}
                        if namespace == "/multi" and event not in {
                            "connect",
                            "disconnect",
                        }:
                            from hearts_server import multiplayer_socket as mp

                            info = mp._sid_to_game.get(request.sid, {})
                            expected = mp._game_auth.get(info.get("game_id"), {}).get(
                                info.get("seat_index")
                            )
                            if expected and (not user or user.id != expected):
                                emit(
                                    "error",
                                    {
                                        "message": "Your account changed. Sign in again to rejoin this game."
                                    },
                                    namespace=namespace,
                                )
                                return {"ok": False}
                        result = handler(*args, **kwargs)
                        if event == "connect" and result is not False:
                            identities[identity_key] = user.id if user else None
                        return result
                finally:
                    request.environ.pop("cards.account_event_primed", None)
                    request.environ.pop("cards.remote_accounts", None)
                    request.environ.pop("cards.game_icon", None)

            return decorate(wrapped)

        return register

    socketio.on = on
