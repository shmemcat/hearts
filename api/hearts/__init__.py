import os
from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO

from hearts.extensions import db, limiter, mail
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
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///hearts.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.config["MAIL_SERVER"] = os.environ.get("MAIL_SERVER", "localhost")
app.config["MAIL_PORT"] = int(os.environ.get("MAIL_PORT", "1025"))
app.config["MAIL_USE_TLS"] = os.environ.get("MAIL_USE_TLS", "").lower() in ("1", "true")
app.config["MAIL_USERNAME"] = os.environ.get("MAIL_USERNAME", "")
app.config["MAIL_PASSWORD"] = os.environ.get("MAIL_PASSWORD", "")
app.config["MAIL_DEFAULT_SENDER"] = os.environ.get(
    "MAIL_DEFAULT_SENDER", "noreply@hearts.local"
)

db.init_app(app)
migrate = Migrate(app, db)
limiter.init_app(app)
mail.init_app(app)
CORS(app, origins=_cors_origins)

from hearts.auth_routes import auth_bp  # noqa: E402
from hearts.game_routes import games_bp  # noqa: E402
from hearts.stats_routes import stats_bp  # noqa: E402
from hearts.game_socket import register_game_socket  # noqa: E402

app.register_blueprint(auth_bp)
app.register_blueprint(games_bp)
app.register_blueprint(stats_bp)
register_game_socket(socketio)


@app.route("/health")
def health():
    return {"status": "ok"}, 200
