"""Compose the current deployment or an isolated service's registrations."""

import os
import json
from urllib.parse import urlsplit

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from flask_socketio import SocketIO
from sqlalchemy.engine import make_url
from werkzeug.middleware.proxy_fix import ProxyFix

from hearts.extensions import db, limiter


def create_app(config=None, *, role="combined", accounts=None):
    if role not in {"combined", "accounts", "hearts", "euchre"}:
        raise ValueError("Unknown application role")
    app = Flask("hearts")
    app.config.from_mapping(
        SQLALCHEMY_DATABASE_URI=os.environ.get("DATABASE_URL", "sqlite:///hearts.db"),
        SQLALCHEMY_TRACK_MODIFICATIONS=False,
        TRUSTED_PROXY_HOPS=int(os.environ.get("TRUSTED_PROXY_HOPS", "0")),
        CORS_ORIGINS=os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:3000,http://localhost:3001,http://localhost:3002",
        ),
        CARDS_PUBLIC_URL=os.environ.get("CARDS_PUBLIC_URL", ""),
        CARDS_EMAIL_TRANSPORT=os.environ.get("CARDS_EMAIL_TRANSPORT", "smtp2go"),
        CARDS_EMAIL_OUTBOX=os.environ.get(
            "CARDS_EMAIL_OUTBOX", os.path.join(app.instance_path, "cards-outbox")
        ),
        FRONTEND_URL=os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        SMTP2GO_API_KEY=os.environ.get("SMTP2GO_API_KEY", ""),
        SMTP2GO_FROM_EMAIL=os.environ.get("SMTP2GO_FROM_EMAIL", "noreply@shmem.dev"),
        CARDS_ACCOUNTS_URL=os.environ.get("CARDS_ACCOUNTS_URL", ""),
        CARDS_SERVICE_ID=os.environ.get("CARDS_SERVICE_ID", "combined-games"),
        CARDS_SERVICE_TOKEN=os.environ.get("CARDS_SERVICE_TOKEN", ""),
        GAME_ACCOUNT_TOKENS=json.loads(
            os.environ.get("CARDS_GAME_ACCOUNT_TOKENS", "{}")
        ),
    )
    app.config.update(config or {})
    database_url = make_url(app.config["SQLALCHEMY_DATABASE_URI"])
    if database_url.drivername == "postgresql":
        database_url = database_url.set(drivername="postgresql+psycopg2")
    app.config["SQLALCHEMY_DATABASE_URI"] = database_url
    proxy_hops = app.config["TRUSTED_PROXY_HOPS"]
    if not 0 <= proxy_hops <= 3:
        raise RuntimeError("TRUSTED_PROXY_HOPS must be between 0 and 3.")
    if proxy_hops:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxy_hops)
    cards_url = app.config["CARDS_PUBLIC_URL"].rstrip("/")
    if cards_url:
        public = urlsplit(cards_url)
        if public.scheme != "https" and not (
            public.scheme == "http" and public.hostname in {"localhost", "127.0.0.1"}
        ):
            raise RuntimeError("CARDS_PUBLIC_URL requires HTTPS except on localhost.")
        if (
            not public.hostname
            or public.path
            or public.query
            or public.fragment
            or public.username is not None
            or public.password is not None
        ):
            raise RuntimeError(
                "CARDS_PUBLIC_URL must be an origin without a path or credentials."
            )
    app.config["CARDS_PUBLIC_URL"] = cards_url
    app.config.setdefault("CARDS_ACCOUNT_ENABLED", bool(cards_url))
    app.config.setdefault("CARDS_COOKIE_SECURE", cards_url.startswith("https://"))
    origins = app.config["CORS_ORIGINS"]
    if isinstance(origins, str):
        origins = [origin.strip() for origin in origins.split(",") if origin.strip()]

    db.init_app(app)
    Migrate(app, db)
    CORS(app, origins=origins)
    from hearts.account_contracts import AccountsUnavailable
    from hearts.account_http import protect_cookie_requests

    if accounts is not None:
        provider = accounts
    elif app.config["CARDS_ACCOUNTS_URL"]:
        from hearts.account_remote import RemoteAccounts

        provider = RemoteAccounts(
            app.config["CARDS_ACCOUNTS_URL"],
            app.config["CARDS_SERVICE_ID"],
            app.config["CARDS_SERVICE_TOKEN"],
        )
    else:
        from hearts.account_local import LocalAccounts

        provider = LocalAccounts()
    app.extensions["accounts"] = provider
    app.config["SERVICE_ROLE"] = role
    remote = getattr(provider, "remote", False)
    if remote and not cards_url:
        raise ValueError("Remote accounts require the shared CARDS_PUBLIC_URL origin")
    if remote and role == "accounts":
        raise ValueError(
            "Use the independent Cards account service for account ownership"
        )
    if remote:
        for game in (("hearts", "euchre") if role == "combined" else (role,)):
            if (
                not isinstance(app.config["GAME_ACCOUNT_TOKENS"].get(game), str)
                or len(app.config["GAME_ACCOUNT_TOKENS"][game]) < 32
            ):
                raise ValueError(
                    "Configure a separate private accounts-to-game token for each game"
                )
        from hearts.game_accounts import install_remote_runtime

        install_remote_runtime(app)
    if remote and role == "combined":
        from hearts.account_relay import register_account_relay

        register_account_relay(app, provider.url)
    elif role in {"combined", "accounts"}:
        from hearts.auth_routes import auth_bp
        from hearts.account_routes import account_bp

        app.register_blueprint(auth_bp)
        app.register_blueprint(account_bp)
    if role in {"combined", "euchre"}:
        from hearts.euchre_routes import euchre_bp

        app.register_blueprint(euchre_bp)
    if role in {"combined", "hearts"}:
        from hearts.game_routes import games_bp
        from hearts.stats_routes import stats_bp
        from hearts.prefs_routes import prefs_bp
        from hearts.lobby_routes import lobby_bp
        from hearts.leaderboard_routes import leaderboard_bp

        for blueprint in (games_bp, stats_bp, prefs_bp, lobby_bp, leaderboard_bp):
            app.register_blueprint(blueprint)
    limiter.init_app(app)
    app.before_request(protect_cookie_requests)

    @app.errorhandler(AccountsUnavailable)
    def accounts_unavailable(error):
        return (
            jsonify(
                error="Accounts are temporarily unavailable. Please retry.",
                code="ACCOUNTS_UNAVAILABLE",
            ),
            503,
        )

    if role != "accounts":
        socketio = SocketIO(app, cors_allowed_origins=origins, async_mode="eventlet")
        if remote:
            from hearts.game_accounts import install_socket_dispatch

            install_socket_dispatch(socketio)
        if role in {"combined", "hearts"}:
            from hearts.game_socket import register_game_socket
            from hearts.lobby_socket import register_lobby_socket
            from hearts.multiplayer_socket import register_multiplayer_socket

            register_game_socket(socketio)
            register_lobby_socket(socketio, app)
            register_multiplayer_socket(socketio)
        if role in {"combined", "euchre"}:
            from hearts.euchre_multiplayer import register_euchre_socket

            register_euchre_socket(socketio, app)

        @socketio.on_error_default
        def socket_error(error):
            if not isinstance(error, AccountsUnavailable):
                raise error
            if request.event["message"] == "connect":
                from socketio.exceptions import ConnectionRefusedError

                raise ConnectionRefusedError(
                    "Accounts are temporarily unavailable. Please retry.",
                    {"code": "ACCOUNTS_UNAVAILABLE"},
                )
            if request.namespace != "/euchre":
                socketio.emit(
                    "error",
                    {
                        "message": "Accounts are temporarily unavailable. Please retry.",
                        "code": "ACCOUNTS_UNAVAILABLE",
                    },
                    to=request.sid,
                    namespace=request.namespace,
                )
            return {
                "ok": False,
                "error": "Accounts are temporarily unavailable. Please retry.",
                "code": "ACCOUNTS_UNAVAILABLE",
            }

    @app.route("/health")
    def health():
        return {"status": "ok"}, 200

    if remote:

        @app.get("/ready")
        def ready():
            from hearts.game_accounts import schema_ready

            good = schema_ready()
            return {"status": "ready" if good else "not-ready"}, 200 if good else 503

    return app
