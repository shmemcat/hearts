from datetime import date

from flask import Blueprint, request, jsonify, g

from hearts.extensions import db
from hearts.models import (
    ActiveGame,
    DifficultyStats,
    GameResult,
    DIFFICULTY_TO_CATEGORY,
    UserStats,
)
from hearts.jwt_utils import require_jwt


def _easter_date(year: int) -> date:
    """Compute Easter Sunday for *year* using the Anonymous Gregorian algorithm."""
    a = year % 19
    b, c = divmod(year, 100)
    d, e = divmod(b, 4)
    f = (b + 8) // 25
    g_ = (b - f + 1) // 3
    h = (19 * a + b - d - g_ + 15) % 30
    i, k = divmod(c, 4)
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month, day = divmod(h + l - 7 * m + 114, 31)
    return date(year, month, day + 1)


def _thanksgiving_date(year: int) -> date:
    """Return Thanksgiving (4th Thursday of November) for *year*."""
    # Nov 1 weekday: 0=Mon … 6=Sun
    first = date(year, 11, 1)
    thu_offset = (3 - first.weekday()) % 7
    return date(year, 11, 1 + thu_offset + 21)


stats_bp = Blueprint("stats", __name__, url_prefix="/stats")

_recorded_games: set = set()

_UNLOCK_WHITELIST = {"geezer", "better_with_friends"}


def reset_recorded_games() -> None:
    _recorded_games.clear()


def _get_or_create_stats(user_id: int) -> UserStats:
    stats = UserStats.query.filter_by(user_id=user_id).first()
    if not stats:
        stats = UserStats(user_id=user_id)
        db.session.add(stats)
        db.session.flush()
    return stats


def _get_or_create_difficulty_stats(user_id: int, category: str) -> DifficultyStats:
    ds = DifficultyStats.query.filter_by(user_id=user_id, category=category).first()
    if not ds:
        ds = DifficultyStats(user_id=user_id, category=category)
        db.session.add(ds)
        db.session.flush()
    return ds


def _is_in_all_time_top_10(user_id: int, difficulty: str, category: str) -> bool:
    """Check if a user is now in the all-time top 10 for a given category."""
    if difficulty in ("hard", "harder", "hardest"):
        col_map = {
            "hard": UserStats.hard_wins,
            "harder": UserStats.harder_wins,
            "hardest": UserStats.hardest_wins,
        }
        col = col_map[difficulty]
        user_val = getattr(
            UserStats.query.filter_by(user_id=user_id).first(), difficulty + "_wins", 0
        )
        count_above = UserStats.query.filter(
            col > user_val, UserStats.user_id != user_id
        ).count()
        return count_above < 10
    else:
        ds = DifficultyStats.query.filter_by(user_id=user_id, category=category).first()
        if not ds:
            return False
        count_above = DifficultyStats.query.filter(
            DifficultyStats.category == category,
            DifficultyStats.games_won > ds.games_won,
            DifficultyStats.user_id != user_id,
        ).count()
        return count_above < 10


def _compute_newly_unlocked(
    old_snapshot: dict, stats: UserStats, won: bool, final_score: int
) -> list[str]:
    """Compare old snapshot to current stats and return list of newly-unlocked achievement IDs."""
    unlocked: list[str] = []

    tier_defs = [
        (
            "games_played",
            [(10, "newcomer_bronze"), (50, "newcomer_silver"), (200, "newcomer_gold")],
        ),
        (
            "games_won",
            [(10, "winner_bronze"), (25, "winner_silver"), (100, "winner_gold")],
        ),
        (
            "moon_shots",
            [(5, "moongazer_bronze"), (10, "moongazer_silver"), (25, "moongazer_gold")],
        ),
        ("hard_wins", [(1, "challenger_bronze")]),
        ("harder_wins", [(1, "challenger_silver")]),
        ("hardest_wins", [(1, "challenger_gold")]),
        ("max_win_streak", [(5, "hot_streak")]),
    ]
    for field, tiers in tier_defs:
        old_val = old_snapshot.get(field, 0)
        new_val = getattr(stats, field)
        for threshold, achievement_id in tiers:
            if old_val < threshold <= new_val:
                unlocked.append(achievement_id)

    best_tiers = [(10, "tidy_bronze"), (5, "tidy_silver"), (0, "tidy_gold")]
    old_best = old_snapshot.get("best_score")
    new_best = stats.best_score
    for threshold, achievement_id in best_tiers:
        old_qualifies = old_best is not None and old_best <= threshold
        new_qualifies = new_best is not None and new_best <= threshold
        if new_qualifies and not old_qualifies:
            unlocked.append(achievement_id)

    def _win_rate(gp, gw):
        return (gw / gp * 100) if gp > 0 else 0

    wr_tiers = [
        (20, 50, "consistent_bronze"),
        (30, 60, "consistent_silver"),
        (50, 75, "consistent_gold"),
    ]
    old_gp = old_snapshot.get("games_played", 0)
    old_gw = old_snapshot.get("games_won", 0)
    for min_games, min_rate, achievement_id in wr_tiers:
        old_qualifies = old_gp >= min_games and _win_rate(old_gp, old_gw) >= min_rate
        new_qualifies = (
            stats.games_played >= min_games
            and _win_rate(stats.games_played, stats.games_won) >= min_rate
        )
        if new_qualifies and not old_qualifies:
            unlocked.append(achievement_id)

    bool_fields = [
        "night_owl",
        "lucky_seven",
        "double_moon",
        "early_bird",
        "lonely_heart",
        "new_year",
        "lucky_clover",
        "easter_egg",
        "fireworks",
        "spooky",
        "thankful",
        "christmas_spirit",
        "photo_finish",
        "demolition",
        "speed_demon",
        "marathon",
        "eclipse",
        "heartbreaker",
        "monthly_star",
        "hall_of_fame",
    ]
    for field in bool_fields:
        if not old_snapshot.get(field) and getattr(stats, field):
            unlocked.append(field)

    if stats.hardest_wins > 0 and old_snapshot.get("hardest_wins", 0) == 0:
        unlocked.append("hi_mom")

    return unlocked


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
        "moon_shots": <int>,
        "round_count": <int>,
        "all_scores": [<int>, ...],
        "hearts_broken_count": <int>
    }

    Returns { "stats": {...}, "newly_unlocked": [...] }
    """
    data = request.get_json() or {}
    game_id = data.get("game_id")
    final_score = data.get("final_score")
    won = data.get("won", False)
    moon_shot_count = data.get("moon_shots", 0)
    round_count = data.get("round_count", 0)
    all_scores = data.get("all_scores", [])
    hearts_broken_count = data.get("hearts_broken_count", 0)

    if not game_id or final_score is None:
        return jsonify({"error": "game_id and final_score are required"}), 400

    try:
        final_score = int(final_score)
        moon_shot_count = int(moon_shot_count)
        round_count = int(round_count)
        all_scores = [int(s) for s in all_scores]
        hearts_broken_count = int(hearts_broken_count)
    except (TypeError, ValueError):
        return jsonify({"error": "Invalid numeric values"}), 400

    dedup_key = f"{g.current_user.id}:{game_id}"
    if dedup_key in _recorded_games:
        stats = _get_or_create_stats(g.current_user.id)
        db.session.commit()
        return jsonify({"stats": stats.to_dict(), "newly_unlocked": []}), 200
    _recorded_games.add(dedup_key)

    active_game = ActiveGame.query.filter_by(game_id=game_id).first()
    difficulty = (
        active_game.difficulty if active_game else (data.get("difficulty") or "easy")
    )
    started_after_midnight = False
    started_early_morning = False
    is_valentines = False
    is_new_year = False
    is_st_patricks = False
    is_easter = False
    is_independence = False
    is_halloween = False
    is_thanksgiving = False
    is_christmas = False
    if active_game and active_game.created_at:
        hour = active_game.created_at.hour
        started_after_midnight = hour < 5
        started_early_morning = 5 <= hour < 8
        started_dt = active_game.created_at
        m, d, y = started_dt.month, started_dt.day, started_dt.year
        is_valentines = m == 2 and d == 14
        is_new_year = m == 1 and d == 1
        is_st_patricks = m == 3 and d == 17
        is_easter = date(y, m, d) == _easter_date(y)
        is_independence = m == 7 and d == 4
        is_halloween = m == 10 and d == 31
        is_thanksgiving = date(y, m, d) == _thanksgiving_date(y)
        is_christmas = m == 12 and d == 25

    if active_game and not active_game.is_multiplayer:
        db.session.delete(active_game)

    opponent_scores = [s for s in all_scores if s != final_score] if all_scores else []
    if len(opponent_scores) == len(all_scores) and all_scores:
        opponent_scores = all_scores[1:]

    stats = _get_or_create_stats(g.current_user.id)

    old_snapshot = {
        "games_played": stats.games_played,
        "games_won": stats.games_won,
        "moon_shots": stats.moon_shots,
        "best_score": stats.best_score,
        "hard_wins": stats.hard_wins,
        "harder_wins": stats.harder_wins,
        "hardest_wins": stats.hardest_wins,
        "max_win_streak": stats.max_win_streak,
        "night_owl": stats.night_owl,
        "lucky_seven": stats.lucky_seven,
        "double_moon": stats.double_moon,
        "early_bird": stats.early_bird,
        "lonely_heart": stats.lonely_heart,
        "photo_finish": stats.photo_finish,
        "demolition": stats.demolition,
        "speed_demon": stats.speed_demon,
        "marathon": stats.marathon,
        "eclipse": stats.eclipse,
        "heartbreaker": stats.heartbreaker,
        "monthly_star": stats.monthly_star,
        "hall_of_fame": stats.hall_of_fame,
        "new_year": stats.new_year,
        "lucky_clover": stats.lucky_clover,
        "easter_egg": stats.easter_egg,
        "fireworks": stats.fireworks,
        "spooky": stats.spooky,
        "thankful": stats.thankful,
        "christmas_spirit": stats.christmas_spirit,
    }

    stats.games_played += 1
    if won:
        stats.games_won += 1
    stats.moon_shots += moon_shot_count
    stats.total_points += final_score
    if stats.best_score is None or final_score < stats.best_score:
        stats.best_score = final_score
    if stats.worst_score is None or final_score > stats.worst_score:
        stats.worst_score = final_score

    if won:
        stats.current_win_streak += 1
        if stats.current_win_streak > stats.max_win_streak:
            stats.max_win_streak = stats.current_win_streak
    else:
        stats.current_win_streak = 0

    if won and difficulty in ("hard", "harder", "hardest"):
        if difficulty == "hard":
            stats.hard_wins += 1
        elif difficulty == "harder":
            stats.harder_wins += 1
        elif difficulty == "hardest":
            stats.hardest_wins += 1

    if started_after_midnight and not stats.night_owl:
        stats.night_owl = True
    if won and final_score == 7 and not stats.lucky_seven:
        stats.lucky_seven = True
    if moon_shot_count >= 2 and not stats.double_moon:
        stats.double_moon = True
    if started_early_morning and not stats.early_bird:
        stats.early_bird = True
    if is_valentines and not stats.lonely_heart:
        stats.lonely_heart = True
    if is_new_year and not stats.new_year:
        stats.new_year = True
    if is_st_patricks and not stats.lucky_clover:
        stats.lucky_clover = True
    if is_easter and not stats.easter_egg:
        stats.easter_egg = True
    if is_independence and not stats.fireworks:
        stats.fireworks = True
    if is_halloween and not stats.spooky:
        stats.spooky = True
    if is_thanksgiving and not stats.thankful:
        stats.thankful = True
    if is_christmas and not stats.christmas_spirit:
        stats.christmas_spirit = True
    if won and opponent_scores and not stats.photo_finish:
        margin = min(opponent_scores) - final_score
        if margin == 1:
            stats.photo_finish = True
    if won and opponent_scores and not stats.demolition:
        if all(s >= 100 for s in opponent_scores):
            stats.demolition = True
    if won and round_count > 0 and round_count <= 4 and not stats.speed_demon:
        stats.speed_demon = True
    if round_count >= 10 and not stats.marathon:
        stats.marathon = True
    if moon_shot_count >= 3 and not stats.eclipse:
        stats.eclipse = True
    if hearts_broken_count >= 5 and not stats.heartbreaker:
        stats.heartbreaker = True

    # ── Per-difficulty stats ────────────────────────────────────────────
    category = DIFFICULTY_TO_CATEGORY.get(difficulty, "easy")

    def _apply_game_to_ds(ds_row):
        ds_row.games_played += 1
        if won:
            ds_row.games_won += 1
        ds_row.moon_shots += moon_shot_count
        ds_row.total_points += final_score
        if ds_row.best_score is None or final_score < ds_row.best_score:
            ds_row.best_score = final_score
        if ds_row.worst_score is None or final_score > ds_row.worst_score:
            ds_row.worst_score = final_score
        if won:
            ds_row.current_win_streak += 1
            if ds_row.current_win_streak > ds_row.max_win_streak:
                ds_row.max_win_streak = ds_row.current_win_streak
        else:
            ds_row.current_win_streak = 0

    ds = _get_or_create_difficulty_stats(g.current_user.id, category)
    _apply_game_to_ds(ds)

    # Dual-write: also record to the raw difficulty row for per-difficulty stats
    if difficulty in ("hard", "harder", "hardest"):
        ds_raw = _get_or_create_difficulty_stats(g.current_user.id, difficulty)
        _apply_game_to_ds(ds_raw)

    # ── Game result log (for leaderboard) ──────────────────────────────
    db.session.add(
        GameResult(
            user_id=g.current_user.id,
            difficulty=difficulty,
            won=won,
        )
    )

    # ── Hall of Fame achievement ────────────────────────────────────────
    if won and not stats.hall_of_fame:
        if _is_in_all_time_top_10(g.current_user.id, difficulty, category):
            stats.hall_of_fame = True

    newly_unlocked = _compute_newly_unlocked(old_snapshot, stats, won, final_score)

    db.session.commit()
    return jsonify({"stats": stats.to_dict(), "newly_unlocked": newly_unlocked}), 200


@stats_bp.route("/by-category", methods=["GET"])
@require_jwt
def get_stats_by_category():
    """Return per-difficulty stats for the authenticated user, keyed by category."""
    rows = DifficultyStats.query.filter_by(user_id=g.current_user.id).all()
    by_cat = {row.category: row.to_dict() for row in rows}
    result = {
        cat: by_cat.get(cat)
        for cat in (
            "easy",
            "medium",
            "my_mom",
            "hard",
            "harder",
            "hardest",
            "multiplayer",
        )
    }
    return jsonify(result), 200


@stats_bp.route("/unlock", methods=["POST"])
@require_jwt
def unlock_achievement():
    """Unlock a UI-triggered achievement (e.g. geezer).

    Body: { "achievement": "geezer" }
    Returns { "stats": {...}, "newly_unlocked": [...] }
    """
    data = request.get_json() or {}
    achievement = data.get("achievement", "")

    if achievement not in _UNLOCK_WHITELIST:
        return jsonify({"error": f"Unknown achievement: {achievement}"}), 400

    stats = _get_or_create_stats(g.current_user.id)
    newly_unlocked: list[str] = []

    if achievement == "geezer" and not stats.geezer:
        stats.geezer = True
        newly_unlocked.append("geezer")

    if achievement == "better_with_friends" and not stats.better_with_friends:
        stats.better_with_friends = True
        newly_unlocked.append("better_with_friends")

    db.session.commit()
    return jsonify({"stats": stats.to_dict(), "newly_unlocked": newly_unlocked}), 200
