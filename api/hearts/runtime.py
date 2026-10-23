"""Application-local live state; only the pure lobby API also works standalone."""

from flask import current_app, has_app_context
from werkzeug.local import LocalProxy


def runtime_state(name, factory=dict, *, standalone=False):
    fallback = factory() if standalone else None

    def resolve():
        if standalone and not has_app_context():
            return fallback
        if has_app_context():
            owner = current_app
        else:
            # Preserve context-free reset helpers used by existing callers.
            from hearts import app

            owner = app
        state = owner.extensions.setdefault("game_runtime", {})
        if name not in state:
            state[name] = factory()
        return state[name]

    return LocalProxy(resolve)
