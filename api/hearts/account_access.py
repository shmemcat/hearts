"""Request-scoped access to an application's injectable account adapter."""

from flask import current_app
from hearts.account_contracts import Accounts


def accounts() -> Accounts:
    return current_app.extensions["accounts"]


def session_user():
    return accounts().cookie_user()


def current_session():
    return accounts().session()


def valid_origin():
    return accounts().valid_origin()
