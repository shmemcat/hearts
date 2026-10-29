from datetime import datetime

from flask import Blueprint, request, jsonify
from sqlalchemy import func

from hearts.extensions import db
from hearts.models import DifficultyStats, GameResult, User, UserStats
from hearts.account_access import accounts
from hearts.game_accounts import is_deleted

leaderboard_bp = Blueprint("leaderboard", __name__, url_prefix="/leaderboard")

_VALID_CATEGORIES = {"easy", "medium", "hard", "harder", "hardest", "multiplayer"}

_HARD_WIN_COL = {
    "hard": UserStats.hard_wins,
    "harder": UserStats.harder_wins,
    "hardest": UserStats.hardest_wins,
}

_CATEGORY_FOR_DS = {"easy": "easy", "medium": "medium", "multiplayer": "multiplayer"}


def _first_of_month() -> datetime:
    now = datetime.utcnow()
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def _all_time_query(category: str) -> list[dict]:
    if getattr(accounts(), "remote", False):
        if category in _CATEGORY_FOR_DS:
            rows = (
                db.session.query(DifficultyStats.user_id, DifficultyStats.games_won)
                .filter(
                    DifficultyStats.category == _CATEGORY_FOR_DS[category],
                    DifficultyStats.games_won > 0,
                )
                .order_by(DifficultyStats.games_won.desc())
                .all()
            )
        elif category in _HARD_WIN_COL:
            column = _HARD_WIN_COL[category]
            rows = (
                db.session.query(UserStats.user_id, column)
                .filter(column > 0)
                .order_by(column.desc())
                .all()
            )
        else:
            rows = []
        return _with_profiles(rows)
    if category in _CATEGORY_FOR_DS:
        rows = (
            db.session.query(
                User.username,
                User.profile_icon,
                DifficultyStats.games_won,
            )
            .join(User, DifficultyStats.user_id == User.id)
            .filter(
                DifficultyStats.category == _CATEGORY_FOR_DS[category],
                DifficultyStats.games_won > 0,
            )
            .order_by(DifficultyStats.games_won.desc())
            .limit(10)
            .all()
        )
    elif category in _HARD_WIN_COL:
        col = _HARD_WIN_COL[category]
        rows = (
            db.session.query(User.username, User.profile_icon, col)
            .join(User, UserStats.user_id == User.id)
            .filter(col > 0)
            .order_by(col.desc())
            .limit(10)
            .all()
        )
    else:
        rows = []

    return [
        {
            "rank": i + 1,
            "username": r[0],
            "profile_icon": r[1],
            "games_won": r[2],
        }
        for i, r in enumerate(rows)
    ]


def _monthly_query(category: str) -> list[dict]:
    if getattr(accounts(), "remote", False):
        rows = (
            db.session.query(GameResult.user_id, func.count(GameResult.id))
            .filter(
                GameResult.difficulty == category,
                GameResult.won.is_(True),
                GameResult.completed_at >= _first_of_month(),
            )
            .group_by(GameResult.user_id)
            .order_by(func.count(GameResult.id).desc())
            .all()
        )
        return _with_profiles(rows)
    month_start = _first_of_month()
    rows = (
        db.session.query(
            User.username,
            User.profile_icon,
            func.count(GameResult.id).label("wins"),
        )
        .join(User, GameResult.user_id == User.id)
        .filter(
            GameResult.difficulty == category,
            GameResult.won.is_(True),
            GameResult.completed_at >= month_start,
        )
        .group_by(GameResult.user_id, User.username, User.profile_icon)
        .order_by(func.count(GameResult.id).desc())
        .limit(10)
        .all()
    )

    return [
        {
            "rank": i + 1,
            "username": r[0],
            "profile_icon": r[1],
            "games_won": r[2],
        }
        for i, r in enumerate(rows)
    ]


def _with_profiles(rows):
    profiles = accounts().public_profiles([row[0] for row in rows])
    visible = [(profiles[uid], count) for uid, count in rows if uid in profiles][:10]
    return [
        dict(
            rank=index + 1,
            username=user.username,
            profile_icon=user.profile_icon,
            games_won=count,
        )
        for index, (user, count) in enumerate(visible)
    ]


@leaderboard_bp.route("", methods=["GET"])
def get_leaderboard():
    category = request.args.get("category", "easy")
    if category == "achievements":
        return jsonify(monthly=[], all_time=_achievement_rankings()), 200
    if category not in _VALID_CATEGORIES:
        return jsonify({"error": f"Invalid category: {category}"}), 400

    return (
        jsonify(
            {
                "monthly": _monthly_query(category),
                "all_time": _all_time_query(category),
            }
        ),
        200,
    )


def _achievement_rankings():
    from .achievement_counts import achievement_count

    rows = [
        (stats.user_id, achievement_count(stats)) for stats in UserStats.query.all()
    ]
    rows = [(uid, count) for uid, count in rows if count > 0 and not is_deleted(uid)]
    profiles = accounts().public_profiles([uid for uid, _ in rows])
    visible = [(profiles[uid], count) for uid, count in rows if uid in profiles]
    visible.sort(key=lambda item: (-item[1], item[0].username.lower(), item[0].id))
    return [
        dict(
            rank=i + 1,
            username=user.username,
            profile_icon=user.profile_icon,
            achievement_count=count,
        )
        for i, (user, count) in enumerate(visible[:10])
    ]


@leaderboard_bp.route("/reset-month", methods=["POST"])
def reset_month():
    """Award monthly_star to users in any monthly top-10, then optionally
    archive old GameResult rows. Call via cron at month rollover."""
    admin_key = request.headers.get("X-Admin-Key", "")
    import os

    import secrets

    expected = os.environ.get("ADMIN_KEY", "")
    if not expected or not admin_key or not secrets.compare_digest(admin_key, expected):
        return jsonify({"error": "unauthorized"}), 403

    month_start = _first_of_month()
    awarded_users: set[int] = set()

    for cat in _VALID_CATEGORIES:
        rows = (
            db.session.query(GameResult.user_id)
            .filter(
                GameResult.difficulty == cat,
                GameResult.won.is_(True),
                GameResult.completed_at >= month_start,
            )
            .group_by(GameResult.user_id)
            .order_by(func.count(GameResult.id).desc())
            .limit(10)
            .all()
        )
        for (uid,) in rows:
            awarded_users.add(uid)

    newly_awarded = 0
    for uid in awarded_users:
        if is_deleted(uid):
            continue
        stats = UserStats.query.filter_by(user_id=uid).first()
        if stats and not stats.monthly_star:
            stats.monthly_star = True
            newly_awarded += 1

    db.session.commit()
    return jsonify({"awarded": newly_awarded, "total_checked": len(awarded_users)}), 200
