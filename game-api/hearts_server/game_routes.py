"""
Game API: DB-backed persistence with in-memory cache.
POST /games/start, GET /games/<id>, POST pass, POST play, POST concede, GET active.
"""

from hearts_server.runtime import runtime_state

import random
import uuid
from typing import Dict, Optional

from flask import Blueprint, request, jsonify, current_app

from hearts_server.extensions import db
from hearts_server.game.card import Card
from hearts_server.game.runner import GameRunner
from hearts_server.ai.factory import create_strategies
from hearts_server.jwt_utils import get_current_user
from hearts_server.models import ActiveGame, UserStats
from hearts_server.stats_routes import _valid_utc_offset
from hearts_server.storage_cleanup import data_for, retire_game
from hearts_server.game_limits import check_creation, open_games, principal

games_bp = Blueprint("games", __name__, url_prefix="/games")


def _inject_player_icons(state: dict, game_id: str) -> dict:
    """Add profile icons to each player in the state dict."""
    user = get_current_user()
    human_icon = user.profile_icon if user else "user"
    for i, p in enumerate(state.get("players", [])):
        p["icon"] = human_icon if i == 0 else "robot"
    return state


_store: Dict[str, GameRunner] = runtime_state("hearts_server.games")


def reset_store() -> None:
    """Clear the in-memory game store. For tests only."""
    _store.clear()


def _get_runner(game_id: str) -> Optional[GameRunner]:
    """Look up a GameRunner: in-memory cache first, then DB fallback."""
    runner = _store.get(game_id)
    if runner is not None:
        return runner
    row = ActiveGame.query.filter_by(game_id=game_id).first()
    if row is None:
        return None
    if data_for(row).get("_closed"):
        return None
    runner = GameRunner.from_json(row.state_json)
    _store[game_id] = runner
    return runner


def _save_to_db(
    game_id: str, runner: GameRunner, user_id: Optional[int] = None
) -> None:
    """Persist the current runner state to the database."""
    from datetime import datetime

    row = ActiveGame.query.filter_by(game_id=game_id).first()
    guest_key = data_for(row).get("_guest_key") if row else None
    if row is None:
        row = ActiveGame(
            game_id=game_id,
            user_id=user_id,
            difficulty=runner.difficulty,
            state_json=runner.to_json(),
        )
        db.session.add(row)
    else:
        if data_for(row).get("_closed"):
            return
        row.state_json = runner.to_json()
        row.updated_at = datetime.utcnow()
    import json
    from flask import has_request_context
    data = json.loads(row.state_json)
    if has_request_context() and not row.user_id:
        data["_guest_key"] = guest_key or getattr(runner, "_quota_guest", None) or principal()
    elif guest_key:
        data["_guest_key"] = guest_key
    row.state_json = json.dumps(data)
    db.session.commit()


def _delete_game(game_id: str) -> None:
    """Close gameplay while retaining a compactable receipt for old requests."""
    retire_game(game_id, reason="conceded")


def _evict_from_cache(game_id: str) -> None:
    """Remove a game from the in-memory cache only.

    The DB row is kept so that record_game can still read the difficulty
    after the game-over response is sent to the client.
    """
    _store.pop(game_id, None)


@games_bp.route("/start", methods=["POST"])
def start_game():
    """Create a new game. Body optional: { "player_name": "You", "seed": <int>, "difficulty": "easy" }.
    Accepts optional JWT to tie the game to a user account.
    Returns { "game_id": "<id>" }."""
    data = request.get_json() or {}
    player_name = (data.get("player_name") or "You").strip() or "You"
    utc_offset_minutes = data.get("utc_offset_minutes")
    if utc_offset_minutes is not None and not _valid_utc_offset(utc_offset_minutes):
        return jsonify({"error": "Invalid local time offset"}), 400
    difficulty = data.get("difficulty", "easy")
    user = get_current_user()
    key = principal(user.id if user else None)
    check_creation(key, open_games(key))
    game_id = uuid.uuid4().hex
    rng = None
    if current_app.config.get("TESTING") and "seed" in data:
        try:
            rng = random.Random(int(data["seed"]))
        except (TypeError, ValueError):
            pass
    pass_strategy, play_strategy = create_strategies(difficulty, rng=rng)
    runner = GameRunner.new_game(
        pass_strategy,
        play_strategy,
        human_name=player_name,
        rng=rng,
        difficulty=difficulty,
    )
    _store[game_id] = runner
    runner.utc_offset_minutes = utc_offset_minutes
    if not user:
        runner._quota_guest = key

    user = get_current_user()
    user_id = user.id if user else None

    _save_to_db(game_id, runner, user_id=user_id)

    return jsonify({"game_id": game_id}), 201


@games_bp.route("/active", methods=["GET"])
def get_active_game():
    """Return the authenticated user's active game_id, or null."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    row = next((row for row in ActiveGame.query.filter_by(user_id=user.id).order_by(ActiveGame.updated_at.desc())
                if not data_for(row).get("state", {}).get("game_over")), None)
    return jsonify({"game_id": row.game_id if row else None})


@games_bp.get("/saved")
def saved_games():
    import json

    user = get_current_user()
    if not user:
        return jsonify(error="Sign in to see your saved games."), 401
    games = []
    for row in ActiveGame.query.order_by(ActiveGame.updated_at.desc()).all():
        data = json.loads(row.state_json)
        state = data.get("state", {})
        if state.get("game_over"):
            continue
        mine = None
        if row.is_multiplayer:
            mine = next((i for i, seat in enumerate(data.get("seats", [])) if seat.get("user_id") == user.id
                         and seat.get("is_human") and not seat.get("conceded")), None)
            if mine is None:
                continue
        elif row.user_id != user.id:
            continue
        item = dict(id=row.game_id, multiplayer=row.is_multiplayer, code=row.lobby_code,
                    difficulty=row.difficulty, round=state.get("round", 1), scores=state.get("scores", []),
                    your_turn=state.get("whose_turn") == (mine if mine is not None else 0))
        if mine is not None:
            item.update(player_token=data["seats"][mine].get("player_token"), seat=mine)
        games.append(item)
    response = jsonify(games=games)
    response.headers["Cache-Control"] = "no-store"
    return response


@games_bp.route("/<game_id>", methods=["GET"])
def get_game(game_id: str):
    """Return current game state for the frontend."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    return jsonify(_inject_player_icons(runner.get_state_for_frontend(), game_id))


@games_bp.post("/saved-guest")
def saved_guest_games():
    import json

    values = (request.get_json() or {}).get("memberships", [])
    if not isinstance(values, list) or len(values) > 100:
        return jsonify(error="Invalid saved games."), 400
    games = []
    for value in values:
        if not isinstance(value, dict):
            continue
        if value.get("lobby"):
            continue
        game_id = value.get("id")
        if not isinstance(game_id, str):
            continue
        row = ActiveGame.query.filter_by(game_id=game_id).first()
        if row is None or row.user_id:
            continue
        data = json.loads(row.state_json)
        state = data.get("state", {})
        if state.get("game_over"):
            continue
        mine = None
        if row.is_multiplayer:
            mine = next((i for i, s in enumerate(data.get("seats", [])) if s.get("player_token") == value.get("token")
                         and not s.get("user_id") and s.get("is_human") and not s.get("conceded")), None)
            if mine is None:
                continue
        games.append(dict(id=row.game_id, multiplayer=row.is_multiplayer, code=row.lobby_code, difficulty=row.difficulty,
                          round=state.get("round", 1), scores=state.get("scores", []), seat=mine,
                          your_turn=state.get("whose_turn") == (mine if mine is not None else 0),
                          player_token=value.get("token") if row.is_multiplayer else None))
    response = jsonify(games=games)
    response.headers["Cache-Control"] = "no-store"
    return response


@games_bp.route("/<game_id>/pass", methods=["POST"])
def submit_pass(game_id: str):
    """Submit human's 3 cards to pass. Body: { "cards": ["As", "Kh", "2c"] }."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    data = request.get_json() or {}
    raw = data.get("cards")
    if not isinstance(raw, list) or len(raw) != 3:
        return jsonify({"error": "Must provide exactly 3 card codes in 'cards'"}), 400
    try:
        cards = [Card.from_code(str(c)) for c in raw]
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    try:
        runner.submit_pass(cards)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    _save_to_db(game_id, runner)
    return jsonify(_inject_player_icons(runner.get_state_for_frontend(), game_id))


@games_bp.route("/<game_id>/advance", methods=["POST"])
def advance_game(game_id: str):
    """Run AI turns until human's turn or round end."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    state = runner.state
    if state.phase.value != "playing":
        return jsonify({"error": "Game is not in playing phase"}), 400
    if state.whose_turn == 0:
        return jsonify({"error": "Already human's turn"}), 400
    try:
        runner.advance_to_human_turn()
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    payload = _inject_player_icons(runner.get_state_for_frontend(), game_id)
    payload["intermediate_plays"] = runner.get_last_play_events()
    payload["round_just_ended"] = runner.get_last_round_ended()
    if runner.state.game_over:
        _save_to_db(game_id, runner)
        _evict_from_cache(game_id)
    else:
        _save_to_db(game_id, runner)
    return jsonify(payload)


@games_bp.route("/<game_id>/play", methods=["POST"])
def submit_play(game_id: str):
    """Play human's card. Body: { "card": "2c" }."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    data = request.get_json() or {}
    raw = data.get("card")
    if raw is None:
        return jsonify({"error": "Must provide a 'card' code"}), 400
    try:
        card = Card.from_code(str(raw))
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    try:
        runner.submit_play(card)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    payload = _inject_player_icons(runner.get_state_for_frontend(), game_id)
    payload["intermediate_plays"] = runner.get_last_play_events()
    payload["round_just_ended"] = runner.get_last_round_ended()
    if runner.state.game_over:
        _save_to_db(game_id, runner)
        _evict_from_cache(game_id)
    else:
        _save_to_db(game_id, runner)
    return jsonify(payload)


@games_bp.route("/<game_id>/concede", methods=["POST"])
def concede_game(game_id: str):
    """Concede and delete the game. Records moon shots and wimp achievement for the authenticated user."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404

    newly_unlocked: list[str] = []
    active_game = ActiveGame.query.filter_by(game_id=game_id).first()

    user = get_current_user()
    if user:
        stats = UserStats.query.filter_by(user_id=user.id).first()
        if not stats:
            stats = UserStats(user_id=user.id, moon_shots=0)
            db.session.add(stats)

        if runner.human_moon_shots > 0:
            stats.moon_shots = (stats.moon_shots or 0) + runner.human_moon_shots

        difficulty = active_game.difficulty if active_game else "easy"
        if difficulty == "hardest" and not stats.wimp:
            stats.wimp = True
            newly_unlocked.append("wimp")

        db.session.commit()

    _delete_game(game_id)
    return jsonify({"status": "conceded", "newly_unlocked": newly_unlocked})
