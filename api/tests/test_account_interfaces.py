"""Account adapters expose small records and never downgrade service errors to guests."""

from dataclasses import asdict, FrozenInstanceError

import pytest

from hearts import create_app
from hearts.account_contracts import (
    AccountIdentity,
    AccountSession,
    AccountsUnavailable,
    DeletionResult,
)
from hearts.account_local import LocalAccounts
from hearts.extensions import db
from tests.test_shared_accounts import accounts, existing_user, sign_in


class StubAccounts:
    def __init__(self):
        self.identity = AccountIdentity(42, "Adapter user", "user", True)
        self.unavailable = False
        self.deleted = []
        self.refreshed = 0

    def cookie_user(self):
        if self.unavailable:
            raise AccountsUnavailable("private diagnostic must not reach clients")
        return self.identity

    def session(self):
        return AccountSession("stub-csrf")

    def legacy_user(self, token):
        return self.cookie_user() if token == "legacy" else None

    def public_profiles(self, ids):
        return {42: self.identity} if 42 in ids else {}

    def valid_origin(self):
        return True

    def valid_csrf(self):
        return True

    def refresh(self):
        self.refreshed += 1

    def delete_account(self, user_id, password):
        self.deleted.append((user_id, password))
        return DeletionResult(True, "Account deleted", 200)


def test_local_adapter_returns_immutable_secret_free_profiles(accounts, existing_user):
    adapter = LocalAccounts()
    profile = adapter.public_profiles([42, 999])[42]
    assert asdict(profile) == {
        "id": 42,
        "username": "existing_hearts",
        "profile_icon": "user",
        "email_verified": True,
    }
    with pytest.raises(FrozenInstanceError):
        profile.username = "changed"
    assert adapter.public_profiles([]) == {}
    sign_in(accounts)
    with accounts.application.test_request_context(
        headers={
            "Cookie": "cards_session=" + accounts.get_cookie("cards_session").value
        }
    ):
        assert adapter.cookie_user() == profile
        assert set(asdict(adapter.session())) == {"csrf_token"}


def make_adapter_app(adapter, role="euchre"):
    app = create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "CARDS_PUBLIC_URL": "http://localhost:3000",
            "RATELIMIT_ENABLED": False,
        },
        role=role,
        accounts=adapter,
    )
    return app


def test_http_identity_and_deletion_use_the_injected_adapter():
    adapter = StubAccounts()
    app = make_adapter_app(adapter, "accounts")
    client = app.test_client()
    response = client.delete("/account", json={"password": "confirmed"})
    assert response.status_code == 200 and response.json == {
        "message": "Account deleted"
    }
    assert adapter.deleted == [(42, "confirmed")]


def test_accounts_outage_is_retryable_http_error_instead_of_guest():
    adapter = StubAccounts()
    adapter.unavailable = True
    app = make_adapter_app(adapter)
    response = app.test_client().get("/account/euchre/multiplayer-results")
    assert response.status_code == 503
    assert response.json["code"] == "ACCOUNTS_UNAVAILABLE"
    assert "private diagnostic" not in response.text


def test_euchre_socket_rejects_handshake_during_accounts_outage():
    adapter = StubAccounts()
    adapter.unavailable = True
    app = make_adapter_app(adapter)
    client = app.extensions["socketio"].test_client(
        app, namespace="/euchre", auth={"csrf": "stub-csrf"}
    )
    assert not client.is_connected("/euchre")
    from hearts.euchre_multiplayer import _clients

    with app.app_context():
        assert not _clients


def test_hearts_socket_outage_preserves_reconnecting_players_bookkeeping():
    from hearts import multiplayer_socket as mp
    from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig

    adapter = StubAccounts()
    adapter.unavailable = True
    app = make_adapter_app(adapter, "hearts")
    runner = MultiplayerRunner.new_game(
        [
            SeatConfig("Host", is_human=True, player_token="seat-token"),
            SeatConfig("Bot 1"),
            SeatConfig("Bot 2"),
            SeatConfig("Bot 3"),
        ]
    )
    with app.app_context():
        mp._runners["game"] = runner
        mp._token_to_sid["seat-token"] = "previous-connection"
    client = app.extensions["socketio"].test_client(
        app, namespace="/multi", query_string="game_id=game&player_token=seat-token"
    )
    assert not client.is_connected("/multi")
    with app.app_context():
        assert mp._token_to_sid["seat-token"] == "previous-connection"
        assert not mp._sid_to_game and not mp._game_auth


def test_socket_outage_does_not_create_a_guest_table_or_drop_identity(monkeypatch):
    adapter = StubAccounts()
    app = make_adapter_app(adapter)
    socketio = app.extensions["socketio"]
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: None)
    client = socketio.test_client(app, namespace="/euchre", auth={"csrf": "stub-csrf"})
    assert client.is_connected("/euchre")
    adapter.unavailable = True
    reply = client.emit(
        "command",
        {"type": "create", "name": "Guest"},
        namespace="/euchre",
        callback=True,
    )
    assert reply["ok"] is False and reply["code"] == "ACCOUNTS_UNAVAILABLE"
    from hearts.euchre_multiplayer import _tables

    with app.app_context():
        assert not _tables
    adapter.unavailable = False
    with app.app_context():
        db.create_all()
    assert client.emit(
        "command", {"type": "create"}, namespace="/euchre", callback=True
    )["ok"]
    assert adapter.refreshed >= 2
    client.disconnect(namespace="/euchre")
    with app.app_context():
        db.drop_all()
