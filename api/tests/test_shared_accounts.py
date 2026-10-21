"""Shared identity, CSRF, recovery and compatibility with existing Hearts records."""

import secrets
import json
from pathlib import Path
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import pytest

ORIGIN = "http://localhost:3000"

# Isolated test users get fresh passwords on every test run.
EXISTING_USER_PASSWORD = secrets.token_urlsafe(24)
RESET_PASSWORD = secrets.token_urlsafe(24)
REGISTERED_USER_PASSWORD = secrets.token_urlsafe(24)
REPLAY_PASSWORD = secrets.token_urlsafe(24)


@pytest.fixture
def accounts(auth_client, tmp_path):
    from hearts import app

    previous = {
        key: app.config.get(key)
        for key in (
            "CARDS_ACCOUNT_ENABLED",
            "CARDS_PUBLIC_URL",
            "CARDS_COOKIE_SECURE",
            "CARDS_EMAIL_TRANSPORT",
            "CARDS_EMAIL_OUTBOX",
        )
    }
    app.config.update(
        CARDS_ACCOUNT_ENABLED=True,
        CARDS_PUBLIC_URL=ORIGIN,
        CARDS_COOKIE_SECURE=False,
        CARDS_EMAIL_TRANSPORT="file",
        CARDS_EMAIL_OUTBOX=str(tmp_path),
    )
    yield auth_client
    app.config.update(previous)


@pytest.fixture
def existing_user(accounts):
    from hearts.auth_utils import hash_password
    from hearts.extensions import db
    from hearts.models import User, UserStats

    user = User(
        id=42,
        username="existing_hearts",
        email="hearts@example.test",
        email_verified=True,
        password_hash=hash_password(EXISTING_USER_PASSWORD),
    )
    db.session.add(user)
    db.session.flush()
    db.session.add(UserStats(user_id=42, games_played=8, games_won=3))
    db.session.commit()
    return user


def post(client, path, data=None, origin=ORIGIN):
    csrf = client.get("/account/session").json["csrf_token"]
    return client.post(
        "/account/" + path,
        json=data or {},
        headers={"X-CSRF-Token": csrf, "Origin": origin},
    )


def sign_in(client, username="existing_hearts"):
    return post(
        client, "login", {"username": username, "password": EXISTING_USER_PASSWORD}
    )


def test_shared_profile_requires_login_and_csrf(accounts, existing_user):
    assert post(accounts, "profile", {"profile_icon": "cat"}).status_code == 401
    sign_in(accounts)
    assert (
        accounts.post("/account/profile", json={"profile_icon": "cat"}).status_code
        == 403
    )
    result = post(accounts, "profile", {"profile_icon": "sparkles"})
    assert result.status_code == 200
    assert result.json["user"]["id"] == "42"
    assert result.json["user"]["profile_icon"] == "sparkles"
    assert accounts.get("/account/session").json["user"]["profile_icon"] == "sparkles"


@pytest.mark.parametrize(
    "data",
    [
        {"profile_icon": "not-an-icon"},
        {"profile_icon": []},
        {"email": "bad"},
        {"email": []},
        {},
    ],
)
def test_shared_profile_rejects_invalid_changes(accounts, existing_user, data):
    sign_in(accounts)
    assert post(accounts, "profile", data).status_code == 400
    assert accounts.get("/account/session").json["user"]["email_verified"] is True


def test_shared_email_change_requires_verification_and_revokes_sessions(
    accounts, existing_user
):
    from hearts.account_sessions import AccountSession
    from hearts.email_utils import hash_token
    from hearts.models import User

    sign_in(accounts)
    other = accounts.application.test_client()
    sign_in(other)
    result = post(accounts, "profile", {"email": "NEW@example.test"})
    assert result.status_code == 200
    assert result.json["user"] is None
    assert "Verify your new address" in result.json["message"]
    assert accounts.get("/account/session").json["user"] is None
    assert other.get("/account/session").json["user"] is None
    assert AccountSession.query.filter_by(user_id=42).count() == 0
    user = User.query.filter_by(id=42).one()
    assert user.email == "new@example.test"
    assert user.email_verified is False
    assert user.auth_version == 1
    from hearts import app

    outbox = list(Path(app.config["CARDS_EMAIL_OUTBOX"]).glob("*.json"))
    mail = json.loads(outbox[0].read_text())
    token = parse_qs(urlsplit(mail["url"]).query)["token"][0]
    assert user.verification_token == hash_token(token)
    assert post(accounts, "verify-email", {"token": token}).status_code == 200
    assert sign_in(accounts).status_code == 200


def test_shared_deletion_confirms_password_and_removes_all_user_data(
    accounts, existing_user
):
    from hearts.extensions import db
    from hearts.account_sessions import AccountSession
    from hearts.models import User, UserStats, DifficultyStats, GameResult

    db.session.add(DifficultyStats(user_id=42, category="easy", games_played=1))
    db.session.add(GameResult(user_id=42, difficulty="easy", won=True))
    db.session.commit()
    sign_in(accounts)
    assert (
        accounts.post(
            "/account/delete", json={"password": EXISTING_USER_PASSWORD}
        ).status_code
        == 403
    )
    assert post(accounts, "delete", {"password": "wrong-password"}).status_code == 401
    assert User.query.count() == 1
    assert (
        post(accounts, "delete", {"password": EXISTING_USER_PASSWORD}).status_code
        == 200
    )
    assert User.query.count() == 0
    for model in (UserStats, DifficultyStats, GameResult, AccountSession):
        assert model.query.filter_by(user_id=42).count() == 0
    assert accounts.get("/account/session").json["user"] is None


def test_existing_hearts_identity_and_stats_are_preserved(accounts, existing_user):
    from hearts.models import User, UserStats

    result = sign_in(accounts)
    assert result.status_code == 200
    assert result.json["user"]["id"] == "42"
    assert "token" not in result.json
    assert accounts.get("/me").json["user"]["id"] == 42
    assert User.query.count() == 1
    assert UserStats.query.filter_by(user_id=42).first().games_won == 3


def test_email_login_and_unverified_accounts(accounts, existing_user):
    from hearts.extensions import db

    assert sign_in(accounts, "HEARTS@example.test").status_code == 200
    post(accounts, "logout")
    existing_user.email_verified = False
    db.session.commit()
    assert sign_in(accounts).status_code == 403


def test_cookie_is_httponly_host_scoped_and_hashed_at_rest(accounts, existing_user):
    from hearts.account_sessions import AccountSession

    result = sign_in(accounts)
    cookie = accounts.get_cookie("cards_session")
    header = result.headers["Set-Cookie"]
    assert "HttpOnly" in header and "SameSite=Lax" in header and "Path=/" in header
    assert "Domain=" not in header
    assert AccountSession.query.filter_by(user_id=42).first().token_hash != cookie.value
    assert result.headers["Cache-Control"] == "no-store"


def test_secure_cookie_in_production(accounts):
    from hearts import app

    app.config.update(
        CARDS_PUBLIC_URL="https://cards.shmem.dev", CARDS_COOKIE_SECURE=True
    )
    response = accounts.get("/account/session")
    assert "__Host-cards_session=" in response.headers["Set-Cookie"]
    assert "Secure" in response.headers["Set-Cookie"]
    assert "Domain=" not in response.headers["Set-Cookie"]


def test_login_rotates_cookie_and_csrf(accounts, existing_user):
    before = accounts.get("/account/session")
    old_cookie = accounts.get_cookie("cards_session").value
    result = sign_in(accounts)
    assert result.json["csrf_token"] != before.json["csrf_token"]
    assert accounts.get_cookie("cards_session").value != old_cookie
    accounts.set_cookie("cards_session", old_cookie)
    assert accounts.get("/account/session").json["user"] is None


@pytest.mark.parametrize(
    "origin", [None, "https://evil.example", "http://localhost:9999"]
)
def test_origin_and_csrf_are_required(accounts, existing_user, origin):
    csrf = accounts.get("/account/session").json["csrf_token"]
    headers = {"X-CSRF-Token": csrf}
    if origin:
        headers["Origin"] = origin
    assert (
        accounts.post(
            "/account/login",
            json={"username": "existing_hearts", "password": EXISTING_USER_PASSWORD},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        accounts.post("/account/login", json={}, headers={"Origin": ORIGIN}).status_code
        == 403
    )


@pytest.mark.parametrize(
    "origin",
    ["http://localhost:3000", "http://localhost:3001", "http://localhost:3002"],
)
def test_all_three_local_sites_share_the_same_cookie_session(
    accounts, existing_user, origin
):
    response = post(
        accounts,
        "login",
        {"username": "existing_hearts", "password": EXISTING_USER_PASSWORD},
        origin=origin,
    )
    assert response.json["user"]["id"] == "42"
    assert accounts.get("/account/session").json["user"]["name"] == "existing_hearts"


def test_existing_hearts_mutations_require_csrf_for_cookie_auth(
    accounts, existing_user
):
    session = sign_in(accounts).json
    assert (
        accounts.patch("/preferences", json={"card_style": "flourish"}).status_code
        == 403
    )
    result = accounts.patch(
        "/preferences",
        json={"card_style": "flourish"},
        headers={"Origin": ORIGIN, "X-CSRF-Token": session["csrf_token"]},
    )
    assert result.status_code == 200


def test_logout_revokes_copied_cookie(accounts, existing_user):
    sign_in(accounts)
    copied_cookie = accounts.get_cookie("cards_session").value
    assert post(accounts, "logout").json["user"] is None
    accounts.set_cookie("cards_session", copied_cookie)
    assert accounts.get("/account/session").json["user"] is None


def test_expired_and_idle_sessions_become_guest(accounts, existing_user):
    from hearts.account_sessions import AccountSession
    from hearts.extensions import db

    sign_in(accounts)
    row = AccountSession.query.filter_by(user_id=42).first()
    row.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.session.commit()
    assert accounts.get("/account/session").json["user"] is None
    sign_in(accounts)
    AccountSession.query.filter_by(user_id=42).first().last_seen_at = (
        datetime.utcnow() - timedelta(hours=13)
    )
    db.session.commit()
    assert accounts.get("/account/session").json["user"] is None


def test_recovery_does_not_disclose_registered_email(accounts, existing_user):
    known = post(accounts, "forgot-password", {"email": "hearts@example.test"})
    unknown = post(accounts, "forgot-password", {"email": "unknown@example.test"})
    assert known.status_code == unknown.status_code == 200
    assert known.json == unknown.json


def test_reset_is_single_use_invalidates_all_sessions_and_old_jwts(
    accounts, existing_user
):
    import json
    from pathlib import Path
    from hearts import app
    from hearts.extensions import db
    from hearts.models import PasswordResetToken, UserStats
    from tests.conftest import make_jwt

    jwt = make_jwt(42)
    sign_in(accounts)
    old_cookie = accounts.get_cookie("cards_session").value
    post(accounts, "forgot-password", {"email": "hearts@example.test"})
    mail = json.loads(
        next(Path(app.config["CARDS_EMAIL_OUTBOX"]).glob("*.json")).read_text()
    )
    token = parse_qs(urlsplit(mail["url"]).query)["token"][0]
    assert token not in PasswordResetToken.query.first().token_hash
    assert mail["url"].startswith(ORIGIN + "/user/?")
    assert "Cards" in mail["subject"]
    response = post(
        accounts, "reset-password", {"token": token, "password": RESET_PASSWORD}
    )
    assert response.status_code == 200
    assert (
        post(
            accounts, "reset-password", {"token": token, "password": REPLAY_PASSWORD}
        ).status_code
        == 400
    )
    accounts.set_cookie("cards_session", old_cookie)
    assert accounts.get("/account/session").json["user"] is None
    assert (
        accounts.get("/me", headers={"Authorization": "Bearer " + jwt}).status_code
        == 401
    )
    assert sign_in(accounts).status_code == 401
    assert (
        post(
            accounts,
            "login",
            {"username": "existing_hearts", "password": RESET_PASSWORD},
        ).status_code
        == 200
    )
    assert UserStats.query.filter_by(user_id=42).first().games_won == 3
    assert db.session.get(type(existing_user), 42).auth_version == 1


def test_reset_expiration_and_legacy_verification_links(accounts, existing_user):
    from hearts.extensions import db
    from hearts.email_utils import hash_token
    from hearts.models import PasswordResetToken

    db.session.add(
        PasswordResetToken(
            user_id=42,
            token_hash=hash_token("expired"),
            expires_at=datetime.utcnow() - timedelta(seconds=1),
        )
    )
    existing_user.email_verified = False
    existing_user.verification_token = "old-hearts-token"
    existing_user.verification_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()
    assert (
        post(
            accounts,
            "reset-password",
            {"token": "expired", "password": RESET_PASSWORD},
        ).status_code
        == 400
    )
    assert (
        post(accounts, "verify-email", {"token": "old-hearts-token"}).status_code == 200
    )
    assert (
        post(accounts, "verify-email", {"token": "old-hearts-token"}).status_code == 400
    )


def test_registration_verifies_with_hashed_one_use_token(accounts):
    import json
    from pathlib import Path
    from hearts import app
    from hearts.models import User

    assert (
        post(
            accounts,
            "register",
            {
                "username": "new_player",
                "email": "new@example.test",
                "password": REGISTERED_USER_PASSWORD,
            },
        ).status_code
        == 201
    )
    user = User.query.filter_by(username="new_player").first()
    mail = json.loads(
        next(Path(app.config["CARDS_EMAIL_OUTBOX"]).glob("*.json")).read_text()
    )
    token = parse_qs(urlsplit(mail["url"]).query)["token"][0]
    assert user.verification_token != token
    assert (
        post(
            accounts,
            "login",
            {"username": "new_player", "password": REGISTERED_USER_PASSWORD},
        ).status_code
        == 403
    )
    assert post(accounts, "verify-email", {"token": token}).status_code == 200
    assert (
        post(
            accounts,
            "login",
            {"username": "new_player", "password": REGISTERED_USER_PASSWORD},
        ).status_code
        == 200
    )


def test_smtp_provider_receives_cards_links_without_changing_existing_mail(accounts):
    from hearts import app
    from hearts.account_routes import send_account_email

    app.config["CARDS_EMAIL_TRANSPORT"] = "smtp2go"
    with (
        patch(
            "hearts.account_routes._mail_workers.submit",
            side_effect=lambda task: task(),
        ),
        patch("hearts.account_routes._send", return_value=True) as sender,
    ):
        send_account_email(
            SimpleNamespace(email="owner@example.test"), "test-token", "reset"
        )
    args = sender.call_args.args
    assert args[0] == "owner@example.test" and "Cards" in args[1]
    assert ORIGIN + "/user/?view=reset" in args[2]
    assert "Hearts account" not in args[2]
    assert sender.call_args.kwargs["sender_name"] == "Cards"


def test_legacy_multiplayer_token_is_revoked_after_recovery(accounts, existing_user):
    from hearts import app
    from hearts.extensions import db
    from hearts.multiplayer_socket import _get_user_from_query_token
    from tests.conftest import make_jwt

    token = make_jwt(42)
    with app.test_request_context(query_string={"auth_token": token}):
        assert _get_user_from_query_token().id == 42
    existing_user.auth_version += 1
    db.session.commit()
    with app.test_request_context(query_string={"auth_token": token}):
        assert _get_user_from_query_token() is None


def test_migration_preserves_existing_users_and_stats(tmp_path):
    import importlib.util
    from pathlib import Path
    import sqlalchemy as sa
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    path = (
        Path(__file__).resolve().parents[1]
        / "migrations/versions/017_add_shared_account_sessions.py"
    )
    spec = importlib.util.spec_from_file_location("shared_accounts_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = sa.create_engine("sqlite:///" + str(tmp_path / "migration.sqlite"))
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT, email_verified BOOLEAN)"
        )
        connection.exec_driver_sql(
            "CREATE TABLE user_stats (user_id INTEGER PRIMARY KEY, games_won INTEGER)"
        )
        connection.exec_driver_sql(
            "INSERT INTO users VALUES (42, 'existing_hearts', 'original-password-hash', 1)"
        )
        connection.exec_driver_sql("INSERT INTO user_stats VALUES (42, 3)")
        migration.op = Operations(MigrationContext.configure(connection))
        migration.upgrade()
        assert connection.exec_driver_sql(
            "SELECT id, username, password_hash, email_verified, auth_version FROM users"
        ).one() == (42, "existing_hearts", "original-password-hash", 1, 0)
        assert (
            connection.exec_driver_sql(
                "SELECT games_won FROM user_stats WHERE user_id=42"
            ).scalar_one()
            == 3
        )
        assert "account_sessions" in sa.inspect(connection).get_table_names()
        migration.downgrade()
        assert (
            connection.exec_driver_sql(
                "SELECT password_hash FROM users WHERE id=42"
            ).scalar_one()
            == "original-password-hash"
        )
        assert (
            connection.exec_driver_sql(
                "SELECT games_won FROM user_stats WHERE user_id=42"
            ).scalar_one()
            == 3
        )
    engine.dispose()


def test_postgresql_account_lock_excludes_nullable_stats_join(accounts):
    from sqlalchemy.dialects import postgresql
    from hearts.models import User

    # User eagerly outer-joins its stats; PostgreSQL cannot lock that nullable
    # side. Verification and recovery must lock only the users table.
    query = User.query.filter_by(id=42).with_for_update(of=User)
    sql = str(query.statement.compile(dialect=postgresql.dialect()))
    assert "LEFT OUTER JOIN user_stats" in sql
    assert sql.endswith("FOR UPDATE OF users")
