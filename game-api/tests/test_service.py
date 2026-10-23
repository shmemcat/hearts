"""The independent runtime owns Hearts data and delegates every identity check."""

import io
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from uuid import uuid4

import pytest
from sqlalchemy import event

from hearts_server import create_app
from hearts_server.account_contracts import AccountsUnavailable
from hearts_server.account_remote import RemoteAccounts
from hearts_server.extensions import db
from hearts_server.models import (
    ActiveGame,
    DifficultyStats,
    GameResult,
    UserPreferences,
    UserStats,
)
from tests.conftest import add_profile, auth_headers, ORIGIN, CALLBACK_KEY, CSRF


def cleanup(client, key=CALLBACK_KEY, uid=42, request_id=None):
    return client.post(
        "/_internal/games/v1/hearts/delete-user",
        json={"user_id": uid, "request_id": request_id or uuid4().hex},
        headers={"X-Cards-Service": "accounts", "Authorization": "Bearer " + key},
    )


def signed(app):
    add_profile(app, 42, "Alice", icon="cat")
    client = app.test_client()
    app.extensions["accounts"].tokens["signed-session"] = 42
    client.set_cookie("cards_session", "signed-session")
    return client


def post(client, path, data=None):
    return client.post(
        path, json=data or {}, headers={"Origin": ORIGIN, "X-CSRF-Token": CSRF}
    )


def multiplayer(app):
    from hearts_server import multiplayer_socket as mp
    from hearts_server.multiplayer_runner import MultiplayerRunner, SeatConfig

    seats = [SeatConfig("Alice", True, "private-seat", user_id=42)] + [
        SeatConfig(f"Bot {n}", False) for n in range(1, 4)
    ]
    runner = MultiplayerRunner.new_game(seats, difficulty="easy")
    mp._runners["saved-multi"] = runner
    mp._game_auth["saved-multi"] = {0: 42}
    mp._save_to_db("saved-multi", runner, lobby_code="ABCDEF")
    return runner


def test_only_hearts_routes_sockets_and_models(app):
    assert set(app.blueprints) == {
        "games",
        "stats",
        "prefs",
        "lobbies",
        "leaderboard",
        "private_game_accounts",
    }
    assert set(app.extensions["socketio"].server.handlers) == {
        "/game",
        "/lobby",
        "/multi",
    }
    assert set(db.metadata.tables) == {
        "active_games",
        "user_stats",
        "user_preferences",
        "difficulty_stats",
        "game_results",
    }
    client = app.test_client()
    for path in [
        "/account/session",
        "/account/login",
        "/login",
        "/register",
        "/account/euchre/leaderboard",
    ]:
        assert client.get(path).status_code == 404
    assert client.get("/health").json["component"] == "hearts-game"
    assert client.get("/ready").status_code == 200


def test_no_account_or_euchre_dependency_and_startup_has_no_ddl():
    code = """
import importlib.abc, sys
class BlockOtherServices(importlib.abc.MetaPathFinder):
    def find_spec(self, fullname, path=None, target=None):
        if fullname.split('.')[0] in {'hearts','euchre_server','cards_accounts','jwt','argon2'}:
            raise AssertionError('Unexpected dependency: ' + fullname)
sys.meta_path.insert(0, BlockOtherServices())
from sqlalchemy import event
from sqlalchemy.engine import Engine
def no_sql(*args):
    raise AssertionError('Startup must not open the database')
event.listen(Engine, 'do_connect', no_sql)
from hearts_server import create_app
app = create_app({'SQLALCHEMY_DATABASE_URI':'sqlite://', 'CARDS_PUBLIC_URL':'http://localhost:3000', 'CARDS_ACCOUNTS_URL':'http://accounts.invalid', 'CARDS_SERVICE_TOKEN':'r'*40, 'GAME_ACCOUNT_TOKENS':{'hearts':'c'*40}})
assert app.test_client().get('/health').status_code == 200
assert set(app.extensions['socketio'].server.handlers) == {'/game','/lobby','/multi'}
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        cwd=Path(__file__).parents[1],
        env={**os.environ, "PYTHONPATH": ""},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_no_implicit_database_or_local_accounts(app, monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    with pytest.raises(ValueError, match="DATABASE_URL"):
        create_app()
    with pytest.raises(ValueError, match="shared accounts"):
        create_app(
            {"SQLALCHEMY_DATABASE_URI": "sqlite://", "CARDS_PUBLIC_URL": ORIGIN},
            accounts=object(),
        )


def test_default_origins_preserve_the_hearts_development_port(app, monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    other = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "CARDS_PUBLIC_URL": ORIGIN,
            "GAME_ACCOUNT_TOKENS": {"hearts": CALLBACK_KEY},
        },
        accounts=app.extensions["accounts"],
    )
    assert (
        "http://localhost:3001"
        in other.extensions["socketio"].server.eio.cors_allowed_origins
    )
    response = other.test_client().get(
        "/health", headers={"Origin": "http://localhost:3001"}
    )
    assert response.headers["Access-Control-Allow-Origin"] == "http://localhost:3001"
    with other.app_context():
        db.engine.dispose()


def test_runtime_never_accesses_account_or_euchre_data(app):
    client = signed(app)
    statements = []

    def forbid(connection, cursor, statement, parameters, context, executemany):
        statements.append(statement)
        assert not re.search(
            r'\b(?:FROM|JOIN|UPDATE|INTO)\s+["`]?\b(users|account_sessions|password_reset_tokens|euchre_tables|euchre_game_results)\b',
            statement,
            re.I,
        )

    event.listen(db.engine, "before_cursor_execute", forbid)
    try:
        assert post(client, "/games/start", {"difficulty": "easy"}).status_code == 201
        assert client.get("/stats").status_code == 200
        assert (
            client.patch(
                "/preferences",
                json={"card_style": "flourish"},
                headers={"Origin": ORIGIN, "X-CSRF-Token": CSRF},
            ).status_code
            == 200
        )
        assert (
            post(client, "/lobbies/create", {"host_name": "Alice"}).status_code == 201
        )
        assert client.get("/leaderboard").status_code == 200
        assert cleanup(client).json["deleted"]
        assert statements
    finally:
        event.remove(db.engine, "before_cursor_execute", forbid)


def test_cookie_csrf_legacy_auth_and_private_preferences(app):
    client = signed(app)
    assert client.post("/games/start", json={}).status_code == 403
    assert post(client, "/games/start", {"difficulty": "easy"}).status_code == 201
    assert client.get("/games/active").json["game_id"]
    legacy = app.test_client()
    assert legacy.get("/stats", headers=auth_headers("legacy-42")).status_code == 200
    assert legacy.get("/stats", headers=auth_headers("forged")).status_code == 401
    headers = {"X-Cards-Service": "accounts", "Authorization": "Bearer " + CALLBACK_KEY}
    db.session.add(UserPreferences(user_id=42, card_style="flourish"))
    db.session.commit()
    assert (
        client.post(
            "/_internal/games/v1/hearts/preferences",
            json={"user_id": 42},
            headers=headers,
        ).json["preferences"]["card_style"]
        == "flourish"
    )
    assert cleanup(client, key="forged").status_code == 401
    assert client.post("/_internal/games/v1/euchre/delete-user").status_code == 404


def test_recovery_preserves_solo_and_multiplayer_account_links(app):
    client = signed(app)
    game_id = post(client, "/games/start", {"difficulty": "easy", "seed": 17}).json[
        "game_id"
    ]
    before = client.get("/games/" + game_id).json
    from hearts_server.game_routes import _store

    _store.clear()
    assert client.get("/games/" + game_id).json == before
    from hearts_server import multiplayer_socket as mp

    runner = multiplayer(app)
    snapshot = runner.to_json()
    mp._runners.clear()
    mp._game_auth.clear()
    recovered = mp._get_runner("saved-multi")
    assert recovered.to_json() == snapshot
    assert mp._game_auth["saved-multi"] == {0: 42}
    assert "private-seat" not in str(recovered.get_state_for_spectator())
    assert "user_id" not in str(recovered.get_state_for_player(0))


def test_cleanup_scrubs_persisted_and_live_games_and_fences_old_identity(app):
    client = signed(app)
    post(client, "/games/start", {"difficulty": "easy"})
    post(client, "/lobbies/create", {"host_name": "Alice"})
    multiplayer(app)
    db.session.add(UserPreferences(user_id=42))
    db.session.add(UserStats(user_id=42))
    db.session.add(DifficultyStats(user_id=42, category="multiplayer"))
    db.session.add(GameResult(user_id=42, difficulty="multiplayer", won=True))
    db.session.commit()
    request_id = uuid4().hex
    assert cleanup(client, request_id=request_id).json["deleted"]
    assert cleanup(client, request_id=request_id).json["deleted"]
    for model in [UserPreferences, UserStats, DifficultyStats, GameResult]:
        assert model.query.filter_by(user_id=42).count() == 0
    assert ActiveGame.query.filter_by(user_id=42).count() == 0
    snapshot = ActiveGame.query.filter_by(game_id="saved-multi").one().state_json
    assert "Alice" not in snapshot and "private-seat" not in snapshot
    assert post(client, "/games/start").status_code == 401
    from hearts_server.game_accounts import is_deleted

    db.session.remove()
    assert is_deleted(42)


def test_signed_socket_revocation_and_guest_continuity_on_outage(app):
    client = signed(app)
    game_id = post(client, "/games/start", {"difficulty": "easy"}).json["game_id"]
    io = app.extensions["socketio"]
    signed_socket = io.test_client(
        app,
        namespace="/game",
        query_string="game_id=" + game_id,
        flask_test_client=client,
    )
    guest = io.test_client(app, namespace="/game", query_string="game_id=" + game_id)
    peer = app.extensions["accounts"]
    peer.unavailable = True
    assert (
        signed_socket.emit("advance", namespace="/game", callback=True)["code"]
        == "ACCOUNTS_UNAVAILABLE"
    )
    guest.emit("advance", namespace="/game")
    assert guest.is_connected("/game")
    peer.unavailable = False
    peer.tokens.pop("signed-session")
    result = signed_socket.emit("advance", namespace="/game", callback=True)
    assert result["ok"] is False
    signed_socket.disconnect(namespace="/game")
    guest.disconnect(namespace="/game")


def test_account_deletion_unblocks_other_players_waiting_for_a_pass(app, monkeypatch):
    from hearts_server import multiplayer_socket as mp
    from hearts_server.game_accounts import is_deleted

    client = signed(app)
    runner = multiplayer(app)
    other = runner.seats[1]
    other.name, other.is_human, other.player_token = "Guest", True, "guest-seat"
    assert runner.submit_pass(1, runner.state.hand(1)[:3]) == "waiting"
    mp._save_to_db("saved-multi", runner)
    socketio = app.extensions["socketio"]
    guest = socketio.test_client(
        app,
        namespace="/multi",
        query_string="game_id=saved-multi&player_token=guest-seat",
    )
    guest.get_received("/multi")
    tasks = []
    monkeypatch.setattr(
        socketio, "start_background_task", lambda fn, *args: tasks.append((fn, args))
    )
    assert cleanup(client).json["deleted"]
    assert is_deleted(42)
    assert runner.state.phase.value == "playing"
    assert len(tasks) == 1
    fn, args = tasks.pop()
    fn(*args)
    view = [
        event["args"][0]
        for event in guest.get_received("/multi")
        if event["name"] == "state"
    ][-1]
    assert guest.is_connected("/multi")
    assert view["players"][0]["name"] == "Bot 1"
    assert view["whose_turn"] == 1 and view["legal_plays"]
    assert UserStats.query.filter_by(user_id=42).first() is None
    guest.disconnect(namespace="/multi")


def test_profiles_filter_missing_accounts_and_preserve_leaderboard_awards(app):
    signed(app)
    for uid, count in [(42, 4), (91, 9)]:
        if uid == 91:
            from sqlalchemy import text

            db.session.execute(text("INSERT INTO users (id) VALUES (91)"))
        db.session.add(DifficultyStats(user_id=uid, category="easy", games_won=count))
    db.session.commit()
    board = app.test_client().get("/leaderboard?category=easy").json
    assert board["all_time"] == [
        {"rank": 1, "username": "Alice", "profile_icon": "cat", "games_won": 4}
    ]


def test_idle_timer_grants_recovery_after_account_outage(app, monkeypatch):
    from hearts_server import multiplayer_socket as mp

    signed(app)
    runner = multiplayer(app)
    scheduled = []

    class Timer:
        def cancel(self):
            pass

    def schedule(seconds, callback, *args):
        scheduled.append((seconds, callback, args))
        return Timer()

    monkeypatch.setattr(mp.eventlet, "spawn_after", schedule)
    mp._start_idle_timer("saved-multi", 0, app.extensions["socketio"], app)
    peer = app.extensions["accounts"]
    peer.unavailable = True
    _, callback, args = scheduled[-1]
    callback(*args)
    assert scheduled[-1][0] == 30 and scheduled[-1][2] == (True,)
    peer.unavailable = False
    _, callback, args = scheduled[-1]
    callback(*args)
    assert scheduled[-1][0] == 30 and scheduled[-1][2] == (False,)
    assert runner.seats[0].is_human and not runner.seats[0].conceded


def test_first_multiplayer_finish_records_defaults_and_achievements_once(app):
    from hearts_server import multiplayer_socket as mp

    signed(app)
    runner = multiplayer(app)
    from dataclasses import replace

    runner._state = replace(
        runner.state, scores=(7, 80, 90, 110), game_over=True, winner_index=0
    )
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert UserStats.query.one().games_played == 1
    assert UserStats.query.one().games_won == 1
    assert UserStats.query.one().lucky_seven is True
    assert DifficultyStats.query.one().games_played == 1
    assert GameResult.query.count() == 1
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert UserStats.query.one().games_played == 1
    assert GameResult.query.count() == 1


@pytest.mark.parametrize(
    "reply", [{}, {"version": 1, "user": {}}, {"version": 1, "user": None}]
)
def test_malformed_account_response_is_retryable(app, monkeypatch, reply):
    client = signed(app)
    monkeypatch.setattr(
        app.extensions["accounts"], "_call", lambda *args, **kwargs: reply
    )
    response = client.get("/preferences")
    assert (
        response.status_code == 503 and response.json["code"] == "ACCOUNTS_UNAVAILABLE"
    )


@pytest.mark.parametrize(
    "payload",
    [b"invalid", b"[]", b'{"version":true}', b'{"version":2}', b"x" * 262145],
    ids=["json", "array", "boolean", "future", "oversized"],
)
def test_account_protocol_is_bounded_and_does_not_follow_redirects(
    app, monkeypatch, payload
):
    class Opener:
        def open(self, request, timeout):
            assert timeout == 2
            assert request.get_header("X-cards-service") == "hearts-game"
            assert json.loads(request.data) == {"token": "browser-legacy-token"}
            return io.BytesIO(payload)

    def build(*handlers):
        assert handlers[0].proxies == {}
        assert (
            handlers[1].redirect_request(
                None, None, 302, None, None, "http://foreign.invalid"
            )
            is None
        )
        return Opener()

    monkeypatch.setattr(
        "hearts_server.account_remote.urllib.request.build_opener", build
    )
    provider = RemoteAccounts("http://accounts.invalid", "hearts-game", "r" * 40)
    with app.test_request_context(), pytest.raises(AccountsUnavailable):
        provider.legacy_user("browser-legacy-token")
