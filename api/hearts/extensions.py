from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

db = SQLAlchemy()


def _get_limiter_key():
    return get_remote_address()


limiter = Limiter(key_func=_get_limiter_key)
