from flask import Blueprint, request, jsonify, g

from hearts.extensions import db
from hearts.models import UserStats
from hearts.jwt_utils import require_jwt

stats_bp = Blueprint("stats", __name__, url_prefix="/stats")

_recorded_games: set = set()


def reset_recorded_games() -> None:
    _recorded_games.clear()


def _get_or_create_stats(user_id: int) -> UserStats:
    stats = UserStats.query.filter_by(user_id=user_id).first()
    if not stats:
        stats = UserStats(user_id=user_id)
        db.session.add(stats)
        db.session.flush()
    return stats


@stats_bp.route("", methods=["GET"])
@require_jwt
def get_stats():
    stats = _get_or_create_stats(g.current_user.id)
    db.session.commit()
    return jsonify({"stats": stats.to_dict()}), 200


@stats_bp.route("/record", methods=["POST"])
@require_jwt
def record_game():
    """Record stats for a completed game.

    Body: {
        "game_id": "<id>",
        "final_score": <int>,
        "won": <bool>,
        "moon_shots": <int>   # number of times player shot the moon this game
    }
    """
    data = request.get_json() or {}
    game_id = data.get("game_id")
    final_score = data.get("final_score")
    won = data.get("won", False)
    moon_shot_count = data.get("moon_shots", 0)

    if not game_id or final_score is None:
        return jsonify({"error": "game_id and final_score are required"}), 400

    try:
        final_score = int(final_score)
        moon_shot_count = int(moon_shot_count)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric values"}), 400

    dedup_key = f"{g.current_user.id}:{game_id}"
    if dedup_key in _recorded_games:
        stats = _get_or_create_stats(g.current_user.id)
        db.session.commit()
        return jsonify({"stats": stats.to_dict()}), 200
    _recorded_games.add(dedup_key)

    stats = _get_or_create_stats(g.current_user.id)
    stats.games_played += 1
    if won:
        stats.games_won += 1
    stats.moon_shots += moon_shot_count
    stats.total_points += final_score
    if stats.best_score is None or final_score < stats.best_score:
        stats.best_score = final_score
    if stats.worst_score is None or final_score > stats.worst_score:
        stats.worst_score = final_score

    db.session.commit()
    return jsonify({"stats": stats.to_dict()}), 200
