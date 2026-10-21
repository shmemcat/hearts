import os
from urllib.parse import urlsplit
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
from sqlalchemy.engine import make_url

from hearts.extensions import db, limiter
from flask_migrate import Migrate

_cors_origins = [
    o.strip()
    for o in os.environ.get(
        "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
    ).split(",")
    if o.strip()
]

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins=_cors_origins, async_mode="eventlet")
_database_url = make_url(os.environ.get("DATABASE_URL", "sqlite:///hearts.db"))
# SQLAlchemy 2.1 defaults to psycopg 3; this project installs psycopg2.
if _database_url.drivername == "postgresql":
    _database_url = _database_url.set(drivername="postgresql+psycopg2")
app.config["SQLALCHEMY_DATABASE_URI"] = _database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
_cards_url = os.environ.get("CARDS_PUBLIC_URL", "").rstrip("/")
if _cards_url:
    _cards_parts = urlsplit(_cards_url)
    if _cards_parts.scheme != "https" and not (
        _cards_parts.scheme == "http"
        and _cards_parts.hostname in {"localhost", "127.0.0.1"}
    ):
        raise RuntimeError("CARDS_PUBLIC_URL requires HTTPS except on localhost.")
    if (
        not _cards_parts.hostname
        or _cards_parts.path
        or _cards_parts.query
        or _cards_parts.fragment
        or _cards_parts.username is not None
        or _cards_parts.password is not None
    ):
        raise RuntimeError(
            "CARDS_PUBLIC_URL must be an origin without a path or credentials."
        )
app.config["CARDS_PUBLIC_URL"] = _cards_url
app.config["CARDS_ACCOUNT_ENABLED"] = bool(_cards_url)
app.config["CARDS_COOKIE_SECURE"] = _cards_url.startswith("https://")
app.config["CARDS_EMAIL_TRANSPORT"] = os.environ.get("CARDS_EMAIL_TRANSPORT", "smtp2go")
app.config["CARDS_EMAIL_OUTBOX"] = os.environ.get(
    "CARDS_EMAIL_OUTBOX", os.path.join(app.instance_path, "cards-outbox")
)
app.config["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.config["SMTP2GO_API_KEY"] = os.environ.get("SMTP2GO_API_KEY", "")
app.config["SMTP2GO_FROM_EMAIL"] = os.environ.get(
    "SMTP2GO_FROM_EMAIL", "noreply@shmem.dev"
)

db.init_app(app)
migrate = Migrate(app, db)
limiter.init_app(app)
CORS(app, origins=_cors_origins)

from hearts.auth_routes import auth_bp  # noqa: E402
from hearts.game_routes import games_bp  # noqa: E402
from hearts.stats_routes import stats_bp  # noqa: E402
from hearts.prefs_routes import prefs_bp  # noqa: E402
from hearts.game_socket import register_game_socket  # noqa: E402
from hearts.lobby_routes import lobby_bp  # noqa: E402
from hearts.lobby_socket import register_lobby_socket  # noqa: E402
from hearts.multiplayer_socket import register_multiplayer_socket  # noqa: E402
from hearts.leaderboard_routes import leaderboard_bp  # noqa: E402

app.register_blueprint(auth_bp)
from hearts.account_routes import account_bp  # noqa: E402
from hearts.account_sessions import protect_cookie_requests  # noqa: E402

app.register_blueprint(account_bp)
from hearts.euchre_routes import euchre_bp  # noqa: E402

app.register_blueprint(euchre_bp)
app.before_request(protect_cookie_requests)
app.register_blueprint(games_bp)
app.register_blueprint(stats_bp)
app.register_blueprint(prefs_bp)
app.register_blueprint(lobby_bp)
app.register_blueprint(leaderboard_bp)
register_game_socket(socketio)
register_lobby_socket(socketio)
register_multiplayer_socket(socketio)


@app.route("/health")
def health():
    return {"status": "ok"}, 200
