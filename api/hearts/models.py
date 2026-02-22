import secrets
from datetime import datetime, timedelta

from hearts.extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False, index=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    email_verified = db.Column(db.Boolean, default=False, nullable=False)
    verification_token = db.Column(db.String(64), unique=True, index=True)
    verification_expires = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    stats = db.relationship(
        "UserStats", uselist=False, back_populates="user", lazy="joined"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "name": self.username,
            "email_verified": self.email_verified,
            "preferences": self.preferences.to_dict() if self.preferences else None,
        }

    def set_verification_token(self, expires_hours=24):
        self.verification_token = secrets.token_urlsafe(32)
        self.verification_expires = datetime.utcnow() + timedelta(hours=expires_hours)


class UserStats(db.Model):
    __tablename__ = "user_stats"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    games_played = db.Column(db.Integer, default=0, nullable=False)
    games_won = db.Column(db.Integer, default=0, nullable=False)
    moon_shots = db.Column(db.Integer, default=0, nullable=False)
    best_score = db.Column(db.Integer, nullable=True)
    worst_score = db.Column(db.Integer, nullable=True)
    total_points = db.Column(db.Integer, default=0, nullable=False)

    user = db.relationship("User", back_populates="stats")

    def to_dict(self):
        return {
            "games_played": self.games_played,
            "games_won": self.games_won,
            "moon_shots": self.moon_shots,
            "best_score": self.best_score,
            "worst_score": self.worst_score,
            "average_score": (
                round(self.total_points / self.games_played, 1)
                if self.games_played > 0
                else None
            ),
        }


class UserPreferences(db.Model):
    __tablename__ = "user_preferences"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )
    card_style = db.Column(db.String(20), default="standard", nullable=False)
    hard_level = db.Column(db.String(20), default="hard", nullable=False)
    mobile_layout = db.Column(db.String(20), default="single", nullable=False)

    user = db.relationship(
        "User", backref=db.backref("preferences", uselist=False, lazy="joined")
    )

    def to_dict(self):
        return {
            "card_style": self.card_style,
            "hard_level": self.hard_level,
            "mobile_layout": self.mobile_layout,
        }


class ActiveGame(db.Model):
    __tablename__ = "active_games"

    id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    difficulty = db.Column(db.String(16), nullable=False, server_default="easy")
    state_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("active_game", uselist=False))


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    token_hash = db.Column(db.String(255), nullable=False, index=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref=db.backref("reset_tokens", lazy="dynamic"))
