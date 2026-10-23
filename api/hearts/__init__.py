"""Application factory with lazy compatibility for the deployed ``hearts:app``."""

from hearts.application import create_app

_default_app = None


def __getattr__(name):
    if name not in {"app", "socketio", "migrate"}:
        raise AttributeError(name)
    global _default_app
    if _default_app is None:
        _default_app = create_app()
    if name == "app":
        return _default_app
    if name == "migrate":
        return _default_app.extensions["migrate"].migrate
    return _default_app.extensions[name]
