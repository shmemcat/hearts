"""
Tests for auth routes: POST /register, POST /login, GET /me,
POST /verify-email, POST /forgot-password, POST /reset-password,
POST /resend-verification, DELETE /account.
"""

import os
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from tests.conftest import JWT_SECRET, make_jwt, auth_headers


@pytest.fixture(autouse=True)
def _set_jwt_secret():
    old = os.environ.get("JWT_SECRET")
    os.environ["JWT_SECRET"] = JWT_SECRET
    yield
    if old is None:
        os.environ.pop("JWT_SECRET", None)
    else:
        os.environ["JWT_SECRET"] = old


def _register(client, username="alice", email="alice@example.com", password="password123"):
    """Register a user. Returns the response. Email send is mocked."""
    with patch("hearts.auth_routes.send_verification_email"):
        return client.post("/register", json={
            "username": username,
            "email": email,
            "password": password,
        })


def _register_and_verify(client, username="alice", email="alice@example.com", password="password123"):
    """Register a user and verify their email."""
    from hearts.extensions import db
    from hearts.models import User
    _register(client, username=username, email=email, password=password)
    user = User.query.filter_by(username=username).first()
    user.email_verified = True
    user.verification_token = None
    user.verification_expires = None
    db.session.commit()


# -----------------------------------------------------------------------------
# POST /register
# -----------------------------------------------------------------------------

class TestRegister:
    def test_register_success(self, auth_client):
        r = _register(auth_client)
        assert r.status_code == 201
        data = r.get_json()
        assert "user" in data
        assert data["user"]["username"] == "alice"
        assert data["user"]["email"] == "alice@example.com"

    def test_register_creates_unverified_user(self, auth_client):
        r = _register(auth_client)
        assert r.status_code == 201
        assert r.get_json()["user"]["email_verified"] is False

    @patch("hearts.auth_routes.send_verification_email")
    def test_register_sends_verification_email(self, mock_send, auth_client):
        auth_client.post("/register", json={
            "username": "alice",
            "email": "alice@example.com",
            "password": "password123",
        })
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "alice@example.com"

    def test_register_message_mentions_verify(self, auth_client):
        r = _register(auth_client)
        assert "verify" in r.get_json()["message"].lower()

    def test_register_duplicate_username(self, auth_client):
        _register(auth_client, username="alice", email="a1@example.com")
        r = _register(auth_client, username="alice", email="a2@example.com")
        assert r.status_code == 409
        assert "username" in r.get_json()["error"].lower()

    def test_register_duplicate_email(self, auth_client):
        _register(auth_client, username="alice1", email="same@example.com")
        r = _register(auth_client, username="alice2", email="same@example.com")
        assert r.status_code == 409
        assert "email" in r.get_json()["error"].lower()

    def test_register_invalid_email(self, auth_client):
        r = _register(auth_client, email="not-an-email")
        assert r.status_code == 400
        assert "email" in r.get_json()["error"].lower()

    def test_register_short_password(self, auth_client):
        r = _register(auth_client, password="short")
        assert r.status_code == 400
        assert "password" in r.get_json()["error"].lower()

    def test_register_missing_username(self, auth_client):
        r = auth_client.post("/register", json={
            "email": "a@example.com",
            "password": "password123",
        })
        assert r.status_code == 400

    def test_register_invalid_username_chars(self, auth_client):
        r = _register(auth_client, username="bad name!")
        assert r.status_code == 400

    def test_register_short_username(self, auth_client):
        r = _register(auth_client, username="ab")
        assert r.status_code == 400


# -----------------------------------------------------------------------------
# POST /login
# -----------------------------------------------------------------------------

class TestLogin:
    def test_login_success(self, auth_client):
        _register_and_verify(auth_client)
        r = auth_client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        assert r.status_code == 200
        data = r.get_json()
        assert "token" in data
        assert data["token"] is not None
        assert data["user"]["username"] == "alice"

    def test_login_rejects_unverified_user(self, auth_client):
        _register(auth_client)
        r = auth_client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        assert r.status_code == 403
        data = r.get_json()
        assert data["code"] == "EMAIL_NOT_VERIFIED"
        assert "verify" in data["error"].lower()

    def test_login_wrong_password(self, auth_client):
        _register_and_verify(auth_client)
        r = auth_client.post("/login", json={
            "username": "alice",
            "password": "wrong-password",
        })
        assert r.status_code == 401

    def test_login_nonexistent_user(self, auth_client):
        r = auth_client.post("/login", json={
            "username": "ghost",
            "password": "password123",
        })
        assert r.status_code == 401

    def test_login_missing_fields(self, auth_client):
        r = auth_client.post("/login", json={})
        assert r.status_code == 401

    def test_login_returns_valid_jwt_for_me(self, auth_client):
        _register_and_verify(auth_client)
        login_r = auth_client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        token = login_r.get_json()["token"]
        me_r = auth_client.get("/me", headers=auth_headers(token))
        assert me_r.status_code == 200
        assert me_r.get_json()["user"]["username"] == "alice"


# -----------------------------------------------------------------------------
# GET /me
# -----------------------------------------------------------------------------

class TestMe:
    def test_me_with_valid_jwt(self, auth_client):
        _register_and_verify(auth_client)
        login_r = auth_client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        token = login_r.get_json()["token"]
        r = auth_client.get("/me", headers=auth_headers(token))
        assert r.status_code == 200
        data = r.get_json()
        assert data["user"]["username"] == "alice"
        assert data["user"]["email"] == "alice@example.com"

    def test_me_without_jwt(self, auth_client):
        r = auth_client.get("/me")
        assert r.status_code == 401

    def test_me_with_invalid_jwt(self, auth_client):
        r = auth_client.get("/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_me_with_nonexistent_user_id(self, auth_client):
        token = make_jwt(user_id=99999, username="ghost")
        r = auth_client.get("/me", headers=auth_headers(token))
        assert r.status_code == 401


# -----------------------------------------------------------------------------
# POST /verify-email
# -----------------------------------------------------------------------------

class TestVerifyEmail:
    def test_verify_success(self, auth_client):
        from hearts.extensions import db
        from hearts.models import User
        _register(auth_client)
        user = User.query.filter_by(username="alice").first()
        token = user.verification_token
        r = auth_client.post("/verify-email", json={"token": token})
        assert r.status_code == 200
        assert r.get_json()["user"]["email_verified"] is True

    def test_verify_allows_login(self, auth_client):
        from hearts.extensions import db
        from hearts.models import User
        _register(auth_client)
        user = User.query.filter_by(username="alice").first()
        token = user.verification_token
        auth_client.post("/verify-email", json={"token": token})
        r = auth_client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        assert r.status_code == 200

    def test_verify_invalid_token(self, auth_client):
        r = auth_client.post("/verify-email", json={"token": "bad-token"})
        assert r.status_code == 400

    def test_verify_expired_token(self, auth_client):
        from hearts.extensions import db
        from hearts.models import User
        _register(auth_client)
        user = User.query.filter_by(username="alice").first()
        user.verification_expires = datetime.utcnow() - timedelta(hours=1)
        token = user.verification_token
        db.session.commit()
        r = auth_client.post("/verify-email", json={"token": token})
        assert r.status_code == 400
        assert "expired" in r.get_json()["error"].lower()

    def test_verify_missing_token(self, auth_client):
        r = auth_client.post("/verify-email", json={})
        assert r.status_code == 400

    def test_verify_consumed_token_rejected(self, auth_client):
        from hearts.models import User
        _register(auth_client)
        user = User.query.filter_by(username="alice").first()
        token = user.verification_token
        auth_client.post("/verify-email", json={"token": token})
        r = auth_client.post("/verify-email", json={"token": token})
        assert r.status_code == 400


# -----------------------------------------------------------------------------
# POST /forgot-password
# -----------------------------------------------------------------------------

class TestForgotPassword:
    @patch("hearts.auth_routes.send_password_reset_email")
    def test_forgot_password_existing_email(self, mock_send, auth_client):
        _register(auth_client)
        r = auth_client.post("/forgot-password", json={"email": "alice@example.com"})
        assert r.status_code == 200
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "alice@example.com"

    @patch("hearts.auth_routes.send_password_reset_email")
    def test_forgot_password_nonexistent_email(self, mock_send, auth_client):
        r = auth_client.post("/forgot-password", json={"email": "nobody@example.com"})
        assert r.status_code == 200
        mock_send.assert_not_called()

    def test_forgot_password_invalid_email(self, auth_client):
        r = auth_client.post("/forgot-password", json={"email": "not-an-email"})
        assert r.status_code == 400


# -----------------------------------------------------------------------------
# POST /reset-password
# -----------------------------------------------------------------------------

class TestResetPassword:
    @patch("hearts.auth_routes.send_password_reset_email")
    def test_reset_password_success(self, mock_send, auth_client):
        from hearts.extensions import db
        from hearts.models import PasswordResetToken
        from hearts.email_utils import hash_token
        _register_and_verify(auth_client)
        auth_client.post("/forgot-password", json={"email": "alice@example.com"})
        raw_token = mock_send.call_args[0][1]
        r = auth_client.post("/reset-password", json={
            "token": raw_token,
            "password": "new_password_123",
        })
        assert r.status_code == 200
        login_r = auth_client.post("/login", json={
            "username": "alice",
            "password": "new_password_123",
        })
        assert login_r.status_code == 200

    def test_reset_password_invalid_token(self, auth_client):
        r = auth_client.post("/reset-password", json={
            "token": "bogus-token",
            "password": "new_password_123",
        })
        assert r.status_code == 400

    @patch("hearts.auth_routes.send_password_reset_email")
    def test_reset_password_expired_token(self, mock_send, auth_client):
        from hearts.extensions import db
        from hearts.models import PasswordResetToken
        from hearts.email_utils import hash_token
        _register(auth_client)
        auth_client.post("/forgot-password", json={"email": "alice@example.com"})
        raw_token = mock_send.call_args[0][1]
        token_hash = hash_token(raw_token)
        reset = PasswordResetToken.query.filter_by(token_hash=token_hash).first()
        reset.expires_at = datetime.utcnow() - timedelta(hours=1)
        db.session.commit()
        r = auth_client.post("/reset-password", json={
            "token": raw_token,
            "password": "new_password_123",
        })
        assert r.status_code == 400
        assert "expired" in r.get_json()["error"].lower()

    def test_reset_password_short_new_password(self, auth_client):
        r = auth_client.post("/reset-password", json={
            "token": "some-token",
            "password": "short",
        })
        assert r.status_code == 400
        assert "password" in r.get_json()["error"].lower()

    def test_reset_password_missing_token(self, auth_client):
        r = auth_client.post("/reset-password", json={
            "password": "new_password_123",
        })
        assert r.status_code == 400


# -----------------------------------------------------------------------------
# POST /resend-verification
# -----------------------------------------------------------------------------

class TestResendVerification:
    @patch("hearts.auth_routes.send_verification_email")
    def test_resend_for_unverified_user(self, mock_send, auth_client):
        _register(auth_client)
        r = auth_client.post("/resend-verification", json={"email": "alice@example.com"})
        assert r.status_code == 200
        mock_send.assert_called_once()
        assert mock_send.call_args[0][0] == "alice@example.com"

    @patch("hearts.auth_routes.send_verification_email")
    def test_resend_for_verified_user_does_not_send(self, mock_send, auth_client):
        _register_and_verify(auth_client)
        r = auth_client.post("/resend-verification", json={"email": "alice@example.com"})
        assert r.status_code == 200
        mock_send.assert_not_called()

    @patch("hearts.auth_routes.send_verification_email")
    def test_resend_for_nonexistent_email_does_not_send(self, mock_send, auth_client):
        r = auth_client.post("/resend-verification", json={"email": "nobody@example.com"})
        assert r.status_code == 200
        mock_send.assert_not_called()

    def test_resend_invalid_email(self, auth_client):
        r = auth_client.post("/resend-verification", json={"email": "bad"})
        assert r.status_code == 400

    @patch("hearts.auth_routes.send_verification_email")
    def test_resend_regenerates_token(self, mock_send, auth_client):
        from hearts.models import User
        _register(auth_client)
        user = User.query.filter_by(username="alice").first()
        old_token = user.verification_token
        auth_client.post("/resend-verification", json={"email": "alice@example.com"})
        from hearts.extensions import db
        db.session.refresh(user)
        assert user.verification_token != old_token


# -----------------------------------------------------------------------------
# DELETE /account
# -----------------------------------------------------------------------------

class TestDeleteAccount:
    def _login_token(self, client):
        _register_and_verify(client)
        r = client.post("/login", json={
            "username": "alice",
            "password": "password123",
        })
        return r.get_json()["token"]

    def test_delete_success(self, auth_client):
        from hearts.models import User
        token = self._login_token(auth_client)
        r = auth_client.delete("/account",
            json={"password": "password123"},
            headers=auth_headers(token),
        )
        assert r.status_code == 200
        assert r.get_json()["message"] == "Account deleted"
        assert User.query.filter_by(username="alice").first() is None

    def test_delete_wrong_password(self, auth_client):
        token = self._login_token(auth_client)
        r = auth_client.delete("/account",
            json={"password": "wrong"},
            headers=auth_headers(token),
        )
        assert r.status_code == 401
        assert "incorrect" in r.get_json()["error"].lower()

    def test_delete_missing_password(self, auth_client):
        token = self._login_token(auth_client)
        r = auth_client.delete("/account",
            json={},
            headers=auth_headers(token),
        )
        assert r.status_code == 400

    def test_delete_requires_auth(self, auth_client):
        r = auth_client.delete("/account", json={"password": "password123"})
        assert r.status_code == 401

    def test_delete_cascades_stats(self, auth_client):
        from hearts.extensions import db
        from hearts.models import User, UserStats
        token = self._login_token(auth_client)
        user = User.query.filter_by(username="alice").first()
        stats = UserStats(user_id=user.id, games_played=5, games_won=2)
        db.session.add(stats)
        db.session.commit()
        r = auth_client.delete("/account",
            json={"password": "password123"},
            headers=auth_headers(token),
        )
        assert r.status_code == 200
        assert UserStats.query.filter_by(user_id=user.id).first() is None

    def test_delete_cascades_reset_tokens(self, auth_client):
        from hearts.extensions import db
        from hearts.models import User, PasswordResetToken
        from hearts.email_utils import hash_token
        token = self._login_token(auth_client)
        user = User.query.filter_by(username="alice").first()
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token("test"),
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.session.add(reset)
        db.session.commit()
        r = auth_client.delete("/account",
            json={"password": "password123"},
            headers=auth_headers(token),
        )
        assert r.status_code == 200
        assert PasswordResetToken.query.filter_by(user_id=user.id).first() is None
