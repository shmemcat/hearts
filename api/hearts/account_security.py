"""Credential changes shared by old Hearts clients and the Cards account API."""

import secrets
from datetime import datetime, timedelta

from hearts.extensions import db
from hearts.models import PasswordResetToken, User
from hearts.auth_utils import hash_password
from hearts.email_utils import hash_token


def change_email(user, email, keep_session=None):
    from hearts.account_sessions import AccountSession

    token = secrets.token_urlsafe(32)
    user.email = email
    user.email_verified = False
    user.verification_token = hash_token(token)
    user.verification_expires = datetime.utcnow() + timedelta(hours=24)
    user.auth_version += 1
    sessions = AccountSession.query.filter_by(user_id=user.id)
    if keep_session:
        sessions = sessions.filter(AccountSession.token_hash != keep_session)
    sessions.delete(synchronize_session=False)
    # Links delivered to the old email address must no longer reset the account.
    PasswordResetToken.query.filter_by(user_id=user.id).delete(
        synchronize_session=False
    )
    return token


def reset_password_with_token(token, password):
    from hearts.account_sessions import AccountSession

    hashed = hash_token(token)
    reset = PasswordResetToken.query.filter_by(token_hash=hashed).first()
    if not reset or reset.expires_at <= datetime.utcnow():
        return False
    # Lock the user before rechecking the token: two valid links for one user
    # must not both succeed, including when consumed through different APIs.
    user = User.query.filter_by(id=reset.user_id).with_for_update(of=User).first()
    if not user:
        return False
    reset = (
        PasswordResetToken.query.populate_existing()
        .filter_by(token_hash=hashed)
        .with_for_update()
        .first()
    )
    if not reset or reset.expires_at <= datetime.utcnow():
        return False
    user.password_hash = hash_password(password)
    user.auth_version += 1
    PasswordResetToken.query.filter_by(user_id=user.id).delete(
        synchronize_session=False
    )
    AccountSession.query.filter_by(user_id=user.id).delete(synchronize_session=False)
    db.session.commit()
    return True
