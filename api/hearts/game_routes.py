"""
Game API: in-memory store, POST /games/start, GET /games/<id>, POST pass, POST play.
"""

import random
import uuid
from typing import Any, Dict, Optional

from flask import Blueprint, request, jsonify, current_app

from hearts.game.card import Card
from hearts.game.runner import GameRunner
from hearts.ai.random_ai import RandomPassStrategy, RandomPlayStrategy

games_bp = Blueprint("games", __name__, url_prefix="/games")

# In-memory store: game_id -> GameRunner (no persistence across restarts)
_store: Dict[str, GameRunner] = {}


def reset_store() -> None:
    """Clear the in-memory game store. For tests only."""
    _store.clear()


def _get_runner(game_id: str) -> Optional[GameRunner]:
    return _store.get(game_id)


def _state_json(runner: GameRunner) -> Dict[str, Any]:
    return runner.get_state_for_frontend()


@games_bp.route("/start", methods=["POST"])
def start_game():
    """Create a new game. Body optional: { "player_name": "You", "seed": <int> }.
    When TESTING is true, "seed" gives a deterministic game for tests.
    Returns { "game_id": "<id>" }."""
    data = request.get_json() or {}
    player_name = (data.get("player_name") or "You").strip() or "You"
    game_id = uuid.uuid4().hex
    rng = None
    if current_app.config.get("TESTING") and "seed" in data:
        try:
            rng = random.Random(int(data["seed"]))
        except (TypeError, ValueError):
            pass
    pass_strategy = RandomPassStrategy(rng=rng) if rng else RandomPassStrategy()
    play_strategy = RandomPlayStrategy(rng=rng) if rng else RandomPlayStrategy()
    runner = GameRunner.new_game(
        pass_strategy,
        play_strategy,
        human_name=player_name,
        rng=rng,
    )
    _store[game_id] = runner
    return jsonify({"game_id": game_id}), 201


@games_bp.route("/<game_id>", methods=["GET"])
def get_game(game_id: str):
    """Return current game state for the frontend."""
    runner = _get_runner(game_id)
    if runner is None:
        return jsonify({"error": "Game not found"}), 404
    return jsonify(_state_json(runner))


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
    return jsonify(_state_json(runner))


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
    return jsonify(_state_json(runner))
