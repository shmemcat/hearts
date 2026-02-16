# autopep8: off

import os
from flask import Flask
from flask_cors import CORS

from hearts.extensions import db, limiter, mail
from flask_migrate import Migrate

app = Flask(__name__)
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
    "DATABASE_URL", "sqlite:///hearts.db"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["FRONTEND_URL"] = os.environ.get("FRONTEND_URL", "http://localhost:3000")
# Mail: set MAIL_SERVER, MAIL_PORT, MAIL_USE_TLS, MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER
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
CORS(
    app,
    origins=[
        o.strip()
        for o in os.environ.get(
            "CORS_ORIGINS", "http://localhost:3000,http://localhost:3001"
        ).split(",")
        if o.strip()
    ],
)

from hearts.auth_routes import auth_bp  # noqa: E402
from hearts.game_routes import games_bp  # noqa: E402

app.register_blueprint(auth_bp)
app.register_blueprint(games_bp)

import hearts.test  # noqa: E402
