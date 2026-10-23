"""Independent Hearts application, with no account implementation or Euchre imports."""

from hearts_server.application import create_app

_default_app = None


def __getattr__(name):
    if name not in {"app", "socketio"}:
        raise AttributeError(name)
    global _default_app
    if _default_app is None:
        _default_app = create_app()
    return _default_app if name == "app" else _default_app.extensions["socketio"]
