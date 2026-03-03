"""
WebSocket handlers for game events: connect (with game_id), advance, play.
Emits play, trick_complete, state (and error) to the client.
Persists state to DB after each completed action.
"""

from typing import Dict

from flask import request
from flask_socketio import emit

from hearts.game_routes import _get_runner, _save_to_db, _evict_from_cache
from hearts.game.card import Card
from hearts.models import ActiveGame, User


_sid_to_game_id: Dict[str, str] = {}
_sid_to_icon: Dict[str, str] = {}


def _lookup_player_icon(game_id: str) -> str:
    """Resolve the human player's profile icon from the ActiveGame's user."""
    row = ActiveGame.query.filter_by(game_id=game_id).first()
    if row and row.user_id:
        user = User.query.get(row.user_id)
        if user:
            return user.profile_icon
    return "user"


def _inject_icons(state: dict, human_icon: str) -> dict:
    for i, p in enumerate(state.get("players", [])):
        p["icon"] = human_icon if i == 0 else "robot"
    return state


def _make_callbacks(runner, game_id, human_icon: str = "user"):
    """Build the on_play / on_trick_complete / on_done callbacks for WebSocket streaming."""

    def on_play(ev):
        emit("play", ev, namespace="/game")

    def on_trick_complete():
        emit("trick_complete", {}, namespace="/game")

    def on_done(s):
        payload = dict(s)
        payload["round_just_ended"] = runner.get_last_round_ended()
        _inject_icons(payload, human_icon)
        emit("state", payload, namespace="/game")
        if runner.state.game_over:
            _evict_from_cache(game_id)
        else:
            _save_to_db(game_id, runner)

    return on_play, on_trick_complete, on_done


def register_game_socket(socketio):
    @socketio.on("connect", namespace="/game")
    def on_connect():
        game_id = (request.args.get("game_id") or "").strip()
        if not game_id:
            return False
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/game")
            return False
        _sid_to_game_id[request.sid] = game_id
        icon = _lookup_player_icon(game_id)
        _sid_to_icon[request.sid] = icon
        emit(
            "state",
            _inject_icons(runner.get_state_for_frontend(), icon),
            namespace="/game",
        )

    @socketio.on("disconnect", namespace="/game")
    def on_disconnect():
        _sid_to_game_id.pop(request.sid, None)
        _sid_to_icon.pop(request.sid, None)

    @socketio.on("advance", namespace="/game")
    def on_advance():
        game_id = _sid_to_game_id.get(request.sid)
        if not game_id:
            emit("error", {"message": "Not connected to a game"}, namespace="/game")
            return
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/game")
            return
        state = runner.state
        if state.phase.value != "playing":
            emit(
                "error", {"message": "Game is not in playing phase"}, namespace="/game"
            )
            return
        if state.whose_turn == 0:
            emit("error", {"message": "Already human's turn"}, namespace="/game")
            return
        try:
            icon = _sid_to_icon.get(request.sid, "user")
            on_play, on_trick_complete, on_done = _make_callbacks(runner, game_id, icon)
            runner.advance_to_human_turn(
                on_play=on_play, on_trick_complete=on_trick_complete, on_done=on_done
            )
        except Exception as e:
            emit("error", {"message": str(e)}, namespace="/game")

    @socketio.on("play", namespace="/game")
    def on_play_message(data):
        game_id = _sid_to_game_id.get(request.sid)
        if not game_id:
            emit("error", {"message": "Not connected to a game"}, namespace="/game")
            return
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/game")
            return
        raw = data.get("card") if isinstance(data, dict) else None
        if raw is None:
            emit("error", {"message": "Must provide a 'card' code"}, namespace="/game")
            return
        try:
            card = Card.from_code(str(raw))
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/game")
            return
        try:
            icon = _sid_to_icon.get(request.sid, "user")
            on_play, on_trick_complete, on_done = _make_callbacks(runner, game_id, icon)
            runner.submit_play(
                card,
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
            )
        except Exception as e:
            emit("error", {"message": str(e)}, namespace="/game")
