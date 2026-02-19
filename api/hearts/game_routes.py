"""
Game API: DB-backed persistence with in-memory cache.
POST /games/start, GET /games/<id>, POST pass, POST play, POST concede, GET active.
"""

import random
import uuid
from typing import Dict, Optional

from flask import Blueprint, request, jsonify, current_app

from hearts.extensions import db
from hearts.game.card import Card
from hearts.game.runner import GameRunner
from hearts.ai.factory import create_strategies
from hearts.jwt_utils import get_current_user
from hearts.models import ActiveGame, UserStats

games_bp = Blueprint("games", __name__, url_prefix="/games")

_store: Dict[str, GameRunner] = {}


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
    runner = GameRunner.from_json(row.state_json)
    _store[game_id] = runner
    return runner


def _save_to_db(game_id: str, runner: GameRunner, user_id: Optional[int] = None) -> None:
    """Persist the current runner state to the database."""
    row = ActiveGame.query.filter_by(game_id=game_id).first()
    if row is None:
        row = ActiveGame(
            game_id=game_id,
            user_id=user_id,
            difficulty=runner.difficulty,
            state_json=runner.to_json(),
        )
        db.session.add(row)
    else:
        row.state_json = runner.to_json()
    db.session.commit()


def _delete_game(game_id: str) -> None:
    """Remove a game from both the cache and the database."""
    _store.pop(game_id, None)
    ActiveGame.query.filter_by(game_id=game_id).delete()
    db.session.commit()


@games_bp.route("/start", methods=["POST"])
def start_game():
    """Create a new game. Body optional: { "player_name": "You", "seed": <int>, "difficulty": "easy" }.
    Accepts optional JWT to tie the game to a user account.
    Returns { "game_id": "<id>" }."""
    data = request.get_json() or {}
    player_name = (data.get("player_name") or "You").strip() or "You"
    difficulty = data.get("difficulty", "easy")
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

    user = get_current_user()
    user_id = user.id if user else None

    if user_id is not None:
        ActiveGame.query.filter_by(user_id=user_id).delete()
        db.session.commit()

    _save_to_db(game_id, runner, user_id=user_id)

    return jsonify({"game_id": game_id}), 201


@games_bp.route("/active", methods=["GET"])
def get_active_game():
    """Return the authenticated user's active game_id, or null."""
    user = get_current_user()
    if not user:
        return jsonify({"error": "Authentication required"}), 401
    row = ActiveGame.query.filter_by(user_id=user.id).first()
    return jsonify({"game_id": row.game_id if row else None})


@games_bp.route("/<game_id>", methods=["GET"])
def get_game(game_id: str):
    """Return current game state for the frontend."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    return jsonify(runner.get_state_for_frontend())


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
    return jsonify(runner.get_state_for_frontend())


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
    payload = runner.get_state_for_frontend()
    payload["intermediate_plays"] = runner.get_last_play_events()
    payload["round_just_ended"] = runner.get_last_round_ended()
    if runner.state.game_over:
        _delete_game(game_id)
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
    payload = runner.get_state_for_frontend()
    payload["intermediate_plays"] = runner.get_last_play_events()
    payload["round_just_ended"] = runner.get_last_round_ended()
    if runner.state.game_over:
        _delete_game(game_id)
    else:
        _save_to_db(game_id, runner)
    return jsonify(payload)


@games_bp.route("/<game_id>/concede", methods=["POST"])
def concede_game(game_id: str):
    """Concede and delete the game. Records moon shots for the authenticated user."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404

    user = get_current_user()
    if user and runner.human_moon_shots > 0:
        stats = UserStats.query.filter_by(user_id=user.id).first()
        if not stats:
            stats = UserStats(user_id=user.id)
            db.session.add(stats)
        stats.moon_shots += runner.human_moon_shots
        db.session.commit()

    _delete_game(game_id)
    return jsonify({"status": "conceded"})
