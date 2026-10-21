"""Account-owned Euchre bot results and Hearts-style win leaderboards."""

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from hearts.account_routes import body, no_store, protect_account
from hearts.account_sessions import session_user
from hearts.extensions import db, limiter
from hearts.models import EuchreGameResult, User

euchre_bp = Blueprint("euchre_stats", __name__, url_prefix="/account/euchre")
euchre_bp.before_request(protect_account)
euchre_bp.after_request(no_store)
BOT_DIFFICULTIES = {"easy", "medium", "hard", "harder", "hardest"}


def parse_result(value, now):
    if not isinstance(value, dict):
        raise ValueError("Invalid game result.")
    game_id = value.get("id")
    difficulty = value.get("difficulty")
    scores = value.get("scores")
    won, conceded = value.get("won"), value.get("conceded")
    if not isinstance(game_id, str) or not 1 <= len(game_id) <= 64:
        raise ValueError("Invalid game identifier.")
    if not isinstance(difficulty, str) or difficulty not in BOT_DIFFICULTIES:
        raise ValueError("Choose a bot difficulty.")
    if (
        not isinstance(scores, list)
        or len(scores) != 2
        or any(type(score) is not int or not 0 <= score <= 13 for score in scores)
        or type(won) is not bool
        or type(conceded) is not bool
    ):
        raise ValueError("Invalid game score.")
    if conceded:
        if won or max(scores) >= 10:
            raise ValueError("Invalid conceded game.")
    elif (scores[0] >= 10) == (scores[1] >= 10) or won != (scores[0] >= 10):
        raise ValueError("Only completed games can be saved.")
    finished = value.get("finishedAt")
    if not isinstance(finished, str) or len(finished) > 40:
        raise ValueError("Invalid completion date.")
    try:
        completed = datetime.fromisoformat(finished.replace("Z", "+00:00"))
        if completed.tzinfo is None:
            raise ValueError()
        completed = completed.astimezone(timezone.utc).replace(tzinfo=None)
    except (ValueError, OverflowError):
        raise ValueError("Invalid completion date.") from None
    if completed < datetime(1970, 1, 1) or completed > now + timedelta(minutes=5):
        raise ValueError("Invalid completion date.")
    return dict(
        game_id=game_id,
        difficulty=difficulty,
        won=won,
        conceded=conceded,
        score=scores[0],
        opponent_score=scores[1],
        completed_at=completed,
    )


@euchre_bp.post("/results")
@limiter.limit("120 per minute")
def save_results():
    user = session_user()
    if not user:
        return jsonify(error="Sign in to save your Euchre results."), 401
    data = body()
    values = data.get("results")
    if not isinstance(values, list) or not 1 <= len(values) <= 40:
        return jsonify(error="Submit between 1 and 40 game results."), 400
    now = datetime.utcnow()
    try:
        parsed = {}
        for value in values:
            result = parse_result(value, now)
            previous = parsed.get(result["game_id"])
            if previous and previous != result:
                raise ValueError("A game can only be saved once.")
            parsed[result["game_id"]] = result
    except ValueError as error:
        return jsonify(error=str(error)), 400
    # Serialize uploads for one account. The unique constraint also protects
    # imports from different tabs and database engines without row locking.
    if not User.query.filter_by(id=user.id).with_for_update(of=User).first():
        return jsonify(error="Sign in to save your Euchre results."), 401
    existing = {
        row.game_id: row
        for row in EuchreGameResult.query.filter(
            EuchreGameResult.user_id == user.id,
            EuchreGameResult.game_id.in_(parsed),
        ).all()
    }
    for game_id, result in parsed.items():
        previous = existing.get(game_id)
        if previous:
            if any(getattr(previous, key) != value for key, value in result.items()):
                db.session.rollback()
                return jsonify(error="That game already has a saved result."), 409
    for game_id, result in parsed.items():
        if game_id not in existing:
            db.session.add(EuchreGameResult(user_id=user.id, **result))
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return jsonify(error="Please retry saving your results."), 409
    return jsonify(saved_ids=list(parsed)), 200


def rankings(category, now, monthly=False):
    wins = func.count(EuchreGameResult.id)
    query = (
        db.session.query(User.username, User.profile_icon, wins)
        .join(EuchreGameResult, EuchreGameResult.user_id == User.id)
        .filter(
            EuchreGameResult.difficulty == category,
            EuchreGameResult.won.is_(True),
            EuchreGameResult.completed_at <= now,
            User.email_verified.is_(True),
        )
    )
    if monthly:
        query = query.filter(
            EuchreGameResult.completed_at
            >= now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        )
    rows = (
        query.group_by(User.id, User.username, User.profile_icon)
        .order_by(wins.desc(), func.lower(User.username), User.id)
        .limit(10)
        .all()
    )
    return [
        dict(rank=index + 1, username=name, profile_icon=icon, games_won=count)
        for index, (name, icon, count) in enumerate(rows)
    ]


@euchre_bp.get("/leaderboard")
@limiter.limit("120 per minute")
def leaderboard():
    category = request.args.get("category", "easy")
    if category == "multiplayer":
        return jsonify(monthly=[], all_time=[])
    if category not in BOT_DIFFICULTIES:
        return jsonify(error="Choose a valid leaderboard category."), 400
    now = datetime.utcnow()
    return jsonify(
        monthly=rankings(category, now, monthly=True), all_time=rankings(category, now)
    )
