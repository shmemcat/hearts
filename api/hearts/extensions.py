from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask import current_app, has_app_context

db = SQLAlchemy()


def _get_limiter_key():
    return get_remote_address()


class ApplicationLimiter:
    """Record blueprint limits, then bind them to an app's own limiter."""

    def limit(self, *args, **kwargs):
        def decorate(view):
            view._cards_limits = (*getattr(view, "_cards_limits", ()), (args, kwargs))
            return view

        return decorate

    def init_app(self, app):
        bound = Limiter(key_func=_get_limiter_key, storage_uri="memory://")
        for endpoint, view in list(app.view_functions.items()):
            for args, kwargs in getattr(view, "_cards_limits", ()):
                view = bound.limit(*args, **kwargs)(view)
            app.view_functions[endpoint] = view
        bound.init_app(app)
        app.extensions["cards_limiter"] = bound

    def _bound(self):
        if has_app_context():
            return current_app.extensions["cards_limiter"]
        from hearts import app

        return app.extensions["cards_limiter"]

    @property
    def enabled(self):
        return self._bound().enabled

    @enabled.setter
    def enabled(self, value):
        self._bound().enabled = value


limiter = ApplicationLimiter()
