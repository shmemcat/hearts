"""
REST endpoints for lobby management: create and query lobbies.
"""

from flask import Blueprint, request, jsonify, current_app

from hearts.extensions import limiter
from hearts.lobby import create_lobby, get_lobby
from hearts.models import ActiveGame

lobby_bp = Blueprint("lobbies", __name__, url_prefix="/lobbies")


@lobby_bp.route("/create", methods=["POST"])
@limiter.limit("5/minute")
def create():
    """Create a new multiplayer lobby.

    Body: { "host_name": "Alice", "num_ai": 0 }
    Returns: { "code": "ABC123", "url": "https://…/game/lobby/ABC123", "player_token": "…" }
    """
    data = request.get_json() or {}
    host_name = (data.get("host_name") or "Host").strip() or "Host"
    num_ai = min(max(int(data.get("num_ai", 0)), 0), 3)

    try:
        lobby = create_lobby(host_name, num_ai)
    except RuntimeError as e:
        return jsonify({"error": str(e)}), 500

    frontend_url = current_app.config.get("FRONTEND_URL", "http://localhost:3000")
    url = f"{frontend_url}/game/lobby/{lobby.code}"

    return (
        jsonify(
            {
                "code": lobby.code,
                "url": url,
                "player_token": lobby.host_token,
            }
        ),
        201,
    )


@lobby_bp.route("/<code>", methods=["GET"])
def get_lobby_state(code: str):
    """Return current lobby state (seats, status, code, game_id)."""
    lobby = get_lobby(code.upper())
    if lobby is None:
        return jsonify({"error": "Lobby not found"}), 404
    return jsonify(lobby.to_dict())


@lobby_bp.route("/game/<game_id>/active", methods=["GET"])
def check_game_active(game_id: str):
    """Return whether a multiplayer game is still active."""
    active = ActiveGame.query.filter_by(game_id=game_id, is_multiplayer=True).first()
    return jsonify({"active": active is not None})
