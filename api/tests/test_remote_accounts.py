"""Private transport failures, durable cleanup, and single-worker write fencing."""

import json
from uuid import uuid4

import pytest

from hearts import create_app
from hearts.account_contracts import AccountsUnavailable
from hearts.account_remote import RemoteAccounts
from hearts.extensions import db
from hearts.game_accounts import upgrade_schema, is_deleted
from hearts.models import User, ActiveGame, UserPreferences
from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig

KEYS = {game: game + "-callback-" + "x" * 40 for game in ("hearts", "euchre")}
IDENTITY = {
    "id": 42,
    "username": "member",
    "profile_icon": "cat",
    "email_verified": True,
}


@pytest.fixture
def remote_app(monkeypatch):
    provider = RemoteAccounts(
        "http://accounts.invalid", "games", "read-key-" + "x" * 40
    )
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "RATELIMIT_ENABLED": False,
            "CARDS_PUBLIC_URL": "http://localhost:3000",
            "GAME_ACCOUNT_TOKENS": KEYS,
        },
        accounts=provider,
    )

    def call(path, data, **kwargs):
        assert app.extensions["game_account_gate"].owner is None
        if path == "profiles":
            return {
                "version": 1,
                "profiles": [IDENTITY] if 42 in data["user_ids"] else [],
            }
        if path == "legacy":
            return {
                "version": 1,
                "user": IDENTITY if data["token"] == "valid" else None,
            }
        return {
            "version": 1,
            "user": IDENTITY,
            "session": {"csrf_token": "test-csrf"},
            "valid_csrf": True,
            "valid_origin": True,
        }

    monkeypatch.setattr(provider, "_call", call)
    with app.app_context():
        db.create_all()
        db.session.add(
            User(
                id=42,
                username="member",
                email="member@example.test",
                password_hash="fixture",
                email_verified=True,
            )
        )
        db.session.commit()
        upgrade_schema()
    yield app
    with app.app_context():
        db.session.remove()
        db.engine.dispose()


def cleanup(client, game="hearts", key=None, request_id=None):
    return client.post(
        f"/_internal/games/v1/{game}/delete-user",
        json={"user_id": 42, "request_id": request_id or uuid4().hex},
        headers={
            "X-Cards-Service": "accounts",
            "Authorization": "Bearer " + (key or KEYS[game]),
        },
    )


def test_private_callbacks_require_their_own_credentials(remote_app):
    client = remote_app.test_client()
    assert cleanup(client, key="forged").status_code == 401
    assert cleanup(client, key=KEYS["euchre"]).status_code == 401
    assert cleanup(client).json["deleted"] is True
    assert cleanup(client).json["deleted"] is True


def test_cleanup_scrubs_persisted_and_cached_multiplayer_and_fences_stale_writes(
    remote_app,
):
    from hearts import multiplayer_socket as mp
    from hearts.game_accounts import game_lock

    client = remote_app.test_client()
    with remote_app.app_context():
        runner = MultiplayerRunner.new_game(
            [SeatConfig("member", True, "private-seat-key", user_id=42)]
            + [SeatConfig(f"Bot {i}", False) for i in range(3)]
        )
        db.session.add(
            ActiveGame(
                game_id="persisted",
                state_json=runner.to_json(),
                is_multiplayer=True,
                difficulty="easy",
            )
        )
        db.session.add(UserPreferences(user_id=42))
        db.session.commit()
        mp._runners["cached-only"] = MultiplayerRunner.from_json(runner.to_json())
        mp._game_auth["cached-only"] = {0: 42}
    assert cleanup(client).status_code == 200
    with remote_app.app_context():
        row = ActiveGame.query.filter_by(game_id="persisted").one()
        assert (
            "private-seat-key" not in row.state_json
            and '"member"' not in row.state_json
        )
        assert mp._runners["cached-only"].seats[0].user_id is None
        assert not mp._game_auth["cached-only"]
        assert UserPreferences.query.count() == 0
        with game_lock():
            assert is_deleted(42)
    # Simulate a stale, still-valid identity response during a deletion race.
    client.set_cookie("cards_session", "opaque")
    assert (
        client.patch("/preferences", json={"card_style": "flourish"}).status_code == 401
    )


def test_legacy_multiplayer_must_drain_before_remote_activation(remote_app):
    with remote_app.app_context():
        runner = MultiplayerRunner.new_game(
            [SeatConfig(f"Player {i}", True, str(i)) for i in range(4)]
        )
        state = runner.to_dict()
        state.pop("account_links_version")
        db.session.add(
            ActiveGame(
                game_id="legacy",
                state_json=json.dumps(state),
                is_multiplayer=True,
                difficulty="easy",
            )
        )
        db.session.commit()
    assert remote_app.test_client().get("/ready").status_code == 503
    assert cleanup(remote_app.test_client()).status_code == 202


def test_identity_failure_is_retryable_not_a_guest_downgrade(remote_app, monkeypatch):
    def offline(*args, **kwargs):
        raise AccountsUnavailable("offline")

    monkeypatch.setattr(remote_app.extensions["accounts"], "_call", offline)
    client = remote_app.test_client()
    client.set_cookie("cards_session", "signed-cookie")
    response = client.get("/preferences")
    assert (
        response.status_code == 503 and response.json["code"] == "ACCOUNTS_UNAVAILABLE"
    )
    client.delete_cookie("cards_session")
    assert client.post("/games/start", json={"difficulty": "easy"}).status_code == 201


@pytest.mark.parametrize(
    "reply",
    [
        {},
        {"version": 2},
        {"version": True},
        {"version": 1, "user": {}},
        {"version": 1, "user": None},
    ],
)
def test_malformed_session_never_becomes_anonymous(remote_app, monkeypatch, reply):
    monkeypatch.setattr(
        remote_app.extensions["accounts"], "_call", lambda *args, **kwargs: reply
    )
    client = remote_app.test_client()
    client.set_cookie("cards_session", "cookie")
    assert client.get("/preferences").status_code == 503


def test_duplicate_profile_ids_are_rejected(remote_app, monkeypatch):
    provider = remote_app.extensions["accounts"]
    monkeypatch.setattr(
        provider,
        "_call",
        lambda *args, **kwargs: {"version": 1, "profiles": [IDENTITY, IDENTITY]},
    )
    with remote_app.test_request_context():
        with pytest.raises(AccountsUnavailable):
            provider.public_profiles([42, 43])


@pytest.mark.parametrize(
    "payload",
    [b"invalid", b"[]", b'{"version":true}', b'{"version":2}', b"x" * 262145],
    ids=["json", "array", "boolean-version", "future-version", "oversized"],
)
def test_private_transport_is_bounded_and_rejects_unknown_contracts(
    remote_app, monkeypatch, payload
):
    import io

    class Opener:
        def open(self, request, timeout):
            assert timeout == 2
            assert request.get_header("X-cards-service") == "games"
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

    monkeypatch.setattr("hearts.account_remote.urllib.request.build_opener", build)
    provider = RemoteAccounts(
        "http://accounts.invalid", "games", "private-key-" + "x" * 40
    )
    with remote_app.test_request_context(), pytest.raises(AccountsUnavailable):
        provider.legacy_user("browser-legacy-token")


def test_idle_timeout_gives_recovery_grace_after_accounts_return(
    remote_app, monkeypatch
):
    from hearts import multiplayer_socket as mp

    scheduled = []

    class Timer:
        def cancel(self):
            pass

    def schedule(seconds, callback, *args):
        scheduled.append((seconds, callback, args))
        return Timer()

    monkeypatch.setattr(mp.eventlet, "spawn_after", schedule)
    with remote_app.app_context():
        runner = MultiplayerRunner.new_game(
            [SeatConfig("member", True, "seat", user_id=42)]
            + [SeatConfig(f"Bot {i}", False) for i in range(3)]
        )
        mp._runners["outage"] = runner
        mp._game_auth["outage"] = {0: 42}
        mp._start_idle_timer("outage", 0, remote_app.extensions["socketio"], remote_app)
    monkeypatch.setattr(mp, "accounts_available", lambda uid: False)
    _, callback, args = scheduled[-1]
    callback(*args)
    assert scheduled[-1][0] == 30 and scheduled[-1][2] == (True,)
    monkeypatch.setattr(mp, "accounts_available", lambda uid: True)
    _, callback, args = scheduled[-1]
    callback(*args)
    assert scheduled[-1][0] == 30 and scheduled[-1][2] == (False,)
    assert runner.seats[0].is_human and not runner.seats[0].conceded
