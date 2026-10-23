"""Factory registration, per-app state and compatibility with the deployed entrypoint."""

import json
import os
from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

import pytest

from hearts import create_app
from hearts.extensions import db


def make_app(role="combined", **config):
    return create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "CARDS_PUBLIC_URL": "http://localhost:3000",
            "RATELIMIT_ENABLED": False,
            **config,
        },
        role=role,
    )


@pytest.mark.parametrize(
    "role,blueprints,namespaces",
    [
        (
            "combined",
            {
                "auth",
                "cards_account",
                "euchre_stats",
                "games",
                "stats",
                "prefs",
                "lobbies",
                "leaderboard",
            },
            {"/game", "/lobby", "/multi", "/euchre"},
        ),
        ("accounts", {"auth", "cards_account"}, set()),
        (
            "hearts",
            {"games", "stats", "prefs", "lobbies", "leaderboard"},
            {"/game", "/lobby", "/multi"},
        ),
        ("euchre", {"euchre_stats"}, {"/euchre"}),
    ],
)
def test_service_registration(role, blueprints, namespaces):
    app = make_app(role)
    assert set(app.blueprints) == blueprints
    socketio = app.extensions.get("socketio")
    assert (set(socketio.server.handlers) if socketio else set()) == namespaces
    client = app.test_client()
    assert client.get("/health").json == {"status": "ok"}
    if role in {"hearts", "euchre"}:
        assert client.post("/account/login").status_code == 404
        assert client.post("/login").status_code == 404


def test_import_and_custom_factories_do_not_initialize_default_app():
    code = """import hearts
assert hearts._default_app is None
app = hearts.create_app({'SQLALCHEMY_DATABASE_URI': 'sqlite://', 'CARDS_PUBLIC_URL': 'http://localhost:3000'}, role='euchre')
assert hearts._default_app is None
assert '/euchre' in app.extensions['socketio'].server.handlers
assert 'hearts.game_routes' not in __import__('sys').modules
assert 'hearts.account_routes' not in __import__('sys').modules
assert 'hearts.auth_routes' not in __import__('sys').modules
from hearts.extensions import db
assert 'account_sessions' in db.metadata.tables
with app.app_context():
    db.create_all()
    client = app.test_client()
    client.set_cookie('cards_session', 'missing')
    assert client.get('/account/euchre/multiplayer-results').status_code == 401
"""
    result = subprocess.run(
        [sys.executable, "-c", code],
        env={**os.environ, "DATABASE_URL": "sqlite://"},
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr


def test_existing_entrypoint_still_returns_one_combined_server():
    from hearts import app, socketio, migrate
    from hearts import app as again

    assert app is again
    assert app.config["SERVICE_ROLE"] == "combined"
    assert socketio is app.extensions["socketio"]
    assert migrate is app.extensions["migrate"].migrate


def test_combined_surface_matches_the_deployed_release():
    # Recorded from the v5.0.2 tag, not generated from the new factory.
    baseline = json.loads(
        (Path(__file__).parent / "fixtures/combined_surface_v1.json").read_text()
    )
    app = make_app()
    routes = sorted(
        [
            {
                "endpoint": rule.endpoint,
                "rule": rule.rule,
                "methods": sorted(rule.methods - {"HEAD", "OPTIONS"}),
            }
            for rule in app.url_map.iter_rules()
        ],
        key=lambda rule: rule["endpoint"],
    )
    assert routes == baseline["http"]
    assert {
        ns: sorted(events)
        for ns, events in app.extensions["socketio"].server.handlers.items()
    } == baseline["sockets"]
    assert sorted(db.metadata.tables) == baseline["tables"]


def test_role_and_security_configuration_validation():
    with pytest.raises(ValueError):
        make_app("typo")
    with pytest.raises(RuntimeError, match="TRUSTED_PROXY_HOPS"):
        make_app(TRUSTED_PROXY_HOPS=4)
    with pytest.raises(RuntimeError, match="requires HTTPS"):
        make_app(CARDS_PUBLIC_URL="http://cards.shmem.dev")
    with pytest.raises(RuntimeError, match="origin without"):
        make_app(CARDS_PUBLIC_URL="https://cards.shmem.dev/path")


def test_factory_apps_do_not_share_database_or_game_caches():
    from hearts.game_routes import _store
    from hearts.lobby import create_lobby, get_lobby
    from hearts.euchre_multiplayer import _tables, _jobs

    first, second = make_app(), make_app()
    assert first.extensions["socketio"] is not second.extensions["socketio"]
    with first.app_context():
        db.create_all()
        _store["same-id"] = object()
        _tables["ABC123"] = {"owner": "first"}
        _jobs["ABC123"] = object()
        code = create_lobby("First").code
        first_engine = db.engine
    with second.app_context():
        db.create_all()
        assert db.engine is not first_engine
        assert "same-id" not in _store
        assert "ABC123" not in _tables and "ABC123" not in _jobs
        assert get_lobby(code) is None
    with first.app_context():
        assert _tables["ABC123"] == {"owner": "first"}
        assert get_lobby(code).seats[0].name == "First"
    for app in (first, second):
        with app.app_context():
            db.drop_all()


def test_rate_limit_counters_and_enabled_settings_are_per_app():
    first = make_app("accounts", RATELIMIT_ENABLED=True)
    second = make_app("accounts", RATELIMIT_ENABLED=True)
    disabled = make_app("accounts")
    clients = [app.test_client() for app in (first, second)]
    # Invalid registration requests still consume the existing 5/minute limit.
    for _ in range(5):
        assert clients[0].post("/register", json={}).status_code == 400
    assert clients[0].post("/register", json={}).status_code == 429
    assert clients[1].post("/register", json={}).status_code == 400
    assert disabled.extensions["cards_limiter"].enabled is False
    assert first.extensions["cards_limiter"].enabled is True


def test_euchre_background_job_keeps_its_factory_application(monkeypatch):
    from hearts import euchre_multiplayer as mp

    new_game = mp.new_game

    def completed_trick(difficulty):
        game = new_game(difficulty)
        game.update(
            phase="trick_complete", turn=1, completedTricks=[dict(plays=[], winner=1)]
        )
        return game

    # Guarantee an automatic job, independent of which player is dealt first.
    monkeypatch.setattr(mp, "new_game", completed_trick)
    first = make_app("euchre")
    socketio = first.extensions["socketio"]
    tasks = []
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: tasks.append(fn))
    monkeypatch.setattr(socketio, "sleep", lambda seconds: None)
    with first.app_context():
        db.create_all()
    client = socketio.test_client(first, namespace="/euchre")
    created = client.emit(
        "command",
        {"type": "create", "name": "Host"},
        namespace="/euchre",
        callback=True,
    )
    assert created["ok"]
    assert client.emit(
        "command", {"type": "start"}, namespace="/euchre", callback=True
    )["ok"]
    with first.app_context():
        table = mp.get_table(created["code"])
        revision = table["revision"]
    # Constructing another app must not redirect the already scheduled callback.
    second = make_app("euchre")
    tasks[-1]()
    with first.app_context():
        assert table["revision"] > revision
        assert table["game"]["phase"] == "playing"
    with second.app_context():
        assert not mp._tables and not mp._jobs
    client.disconnect(namespace="/euchre")
    with first.app_context():
        db.drop_all()


def test_hearts_lobby_timeout_keeps_its_factory_application(monkeypatch):
    from hearts import lobby_socket
    from hearts.lobby import create_lobby

    tasks = []

    def spawn_after(seconds, callback):
        tasks.append(callback)
        return SimpleNamespace(cancel=lambda: None)

    monkeypatch.setattr(lobby_socket.eventlet, "spawn_after", spawn_after)
    first = make_app("hearts")
    with first.app_context():
        original = create_lobby("Original host")
    client = first.extensions["socketio"].test_client(
        first,
        namespace="/lobby",
        auth={"lobby_code": original.code, "player_token": original.host_token},
    )
    client.disconnect(namespace="/lobby")
    second = make_app("hearts")
    with second.app_context():
        other = create_lobby("Other host")
        # The timer must use first even when another app is currently active.
        tasks[0]()
        assert other.status == "waiting"
    with first.app_context():
        assert original.status == "finished"
