"""Hearts-owned records. Account IDs are opaque; Cards owns identity."""

from datetime import datetime
from hearts_server.extensions import db


class UserStats(db.Model):
    __tablename__ = "user_stats"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, unique=True, nullable=False)
    games_played = db.Column(db.Integer, default=0, nullable=False)
    games_won = db.Column(db.Integer, default=0, nullable=False)
    moon_shots = db.Column(db.Integer, default=0, nullable=False)
    best_score = db.Column(db.Integer, nullable=True)
    worst_score = db.Column(db.Integer, nullable=True)
    total_points = db.Column(db.Integer, default=0, nullable=False)
    hard_wins = db.Column(db.Integer, default=0, nullable=False, server_default="0")
    harder_wins = db.Column(db.Integer, default=0, nullable=False, server_default="0")
    hardest_wins = db.Column(db.Integer, default=0, nullable=False, server_default="0")
    current_win_streak = db.Column(
        db.Integer, default=0, nullable=False, server_default="0"
    )
    max_win_streak = db.Column(
        db.Integer, default=0, nullable=False, server_default="0"
    )
    night_owl = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    lucky_seven = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    double_moon = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    geezer = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    wimp = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    early_bird = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    lonely_heart = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    photo_finish = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    demolition = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    speed_demon = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    marathon = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    eclipse = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    heartbreaker = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    monthly_star = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    hall_of_fame = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    new_year = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    lucky_clover = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    easter_egg = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    fireworks = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    spooky = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    thankful = db.Column(db.Boolean, default=False, nullable=False, server_default="0")
    christmas_spirit = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    better_with_friends = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    biggest_loser = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )

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
            "hard_wins": self.hard_wins,
            "harder_wins": self.harder_wins,
            "hardest_wins": self.hardest_wins,
            "current_win_streak": self.current_win_streak,
            "max_win_streak": self.max_win_streak,
            "night_owl": self.night_owl,
            "lucky_seven": self.lucky_seven,
            "double_moon": self.double_moon,
            "geezer": self.geezer,
            "wimp": self.wimp,
            "early_bird": self.early_bird,
            "lonely_heart": self.lonely_heart,
            "photo_finish": self.photo_finish,
            "demolition": self.demolition,
            "speed_demon": self.speed_demon,
            "marathon": self.marathon,
            "eclipse": self.eclipse,
            "heartbreaker": self.heartbreaker,
            "monthly_star": self.monthly_star,
            "hall_of_fame": self.hall_of_fame,
            "new_year": self.new_year,
            "lucky_clover": self.lucky_clover,
            "easter_egg": self.easter_egg,
            "fireworks": self.fireworks,
            "spooky": self.spooky,
            "thankful": self.thankful,
            "christmas_spirit": self.christmas_spirit,
            "better_with_friends": self.better_with_friends,
            "biggest_loser": self.biggest_loser,
        }


class UserPreferences(db.Model):
    __tablename__ = "user_preferences"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, unique=True, nullable=False)
    card_style = db.Column(db.String(20), default="standard", nullable=False)
    hard_level = db.Column(db.String(20), default="hard", nullable=False)
    mobile_layout = db.Column(db.String(20), default="single", nullable=False)

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
    user_id = db.Column(db.Integer, nullable=True, index=True)
    difficulty = db.Column(db.String(16), nullable=False, server_default="easy")
    state_json = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    is_multiplayer = db.Column(
        db.Boolean, default=False, nullable=False, server_default="0"
    )
    lobby_code = db.Column(db.String(10), nullable=True, index=True)


DIFFICULTY_TO_CATEGORY = {
    "easy": "easy",
    "medium": "medium",
    "hard": "my_mom",
    "harder": "my_mom",
    "hardest": "my_mom",
    "multiplayer": "multiplayer",
}


class DifficultyStats(db.Model):
    __tablename__ = "difficulty_stats"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(16), nullable=False)
    games_played = db.Column(db.Integer, default=0, nullable=False)
    games_won = db.Column(db.Integer, default=0, nullable=False)
    moon_shots = db.Column(db.Integer, default=0, nullable=False)
    best_score = db.Column(db.Integer, nullable=True)
    worst_score = db.Column(db.Integer, nullable=True)
    total_points = db.Column(db.Integer, default=0, nullable=False)
    current_win_streak = db.Column(
        db.Integer, default=0, nullable=False, server_default="0"
    )
    max_win_streak = db.Column(
        db.Integer, default=0, nullable=False, server_default="0"
    )
    __table_args__ = (
        db.UniqueConstraint(
            "user_id", "category", name="uq_difficulty_stats_user_category"
        ),
    )

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
            "current_win_streak": self.current_win_streak,
            "max_win_streak": self.max_win_streak,
        }


class GameResult(db.Model):
    __tablename__ = "game_results"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, nullable=False, index=True)
    difficulty = db.Column(db.String(16), nullable=False, index=True)
    won = db.Column(db.Boolean, default=False, nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
