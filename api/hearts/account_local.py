"""Current database implementation of the account port; no network requests."""

import os
import jwt
from flask import current_app, request

from hearts.account_contracts import AccountIdentity, AccountSession, DeletionResult
from hearts import account_sessions
from hearts.extensions import db
from hearts.models import User


def identity(user):
    if user is None:
        return None
    return AccountIdentity(
        user.id, user.username, user.profile_icon, user.email_verified
    )


class LocalAccounts:
    def session(self):
        row = account_sessions.current_session()
        return AccountSession(row.csrf_token) if row else None

    def cookie_user(self):
        return identity(account_sessions.session_user())

    def legacy_user(self, token):
        secret = os.environ.get("JWT_SECRET") or current_app.config.get("JWT_SECRET")
        if not secret:
            return None
        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
            user_id = payload.get("sub")
            if not user_id:
                return None
            user = db.session.get(User, int(user_id))
            return (
                identity(user)
                if user and payload.get("av", 0) == user.auth_version
                else None
            )
        except (jwt.InvalidTokenError, ValueError, TypeError, OverflowError):
            return None

    def public_profiles(self, user_ids):
        ids = set(user_ids)
        if not ids:
            return {}
        return {user.id: identity(user) for user in User.query.filter(User.id.in_(ids))}

    def valid_origin(self):
        return account_sessions.valid_origin()

    def valid_csrf(self):
        return account_sessions.valid_csrf(account_sessions.current_session())

    def refresh(self):
        request.environ.pop("cards.session", None)

    def delete_account(self, user_id, password):
        from hearts.auth_utils import verify_password
        from hearts.models import (
            PasswordResetToken,
            ActiveGame,
            UserStats,
            UserPreferences,
            DifficultyStats,
            GameResult,
            EuchreGameResult,
        )

        if not isinstance(password, str) or not password:
            return DeletionResult(False, "Password required", 400)
        user = db.session.get(User, user_id)
        if not user or not verify_password(password, user.password_hash):
            return DeletionResult(False, "Incorrect password", 401)
        for model in (
            PasswordResetToken,
            ActiveGame,
            UserStats,
            UserPreferences,
            DifficultyStats,
            GameResult,
            EuchreGameResult,
            account_sessions.AccountSession,
        ):
            model.query.filter_by(user_id=user.id).delete(synchronize_session=False)
        User.query.filter_by(id=user.id).delete(synchronize_session="fetch")
        db.session.commit()
        return DeletionResult(True, "Account deleted", 200)
