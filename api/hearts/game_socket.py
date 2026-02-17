"""
WebSocket handlers for game events: connect (with game_id), advance, play.
Emits play, trick_complete, state (and error) to the client.
"""

from typing import Dict

from flask import request
from flask_socketio import emit

from hearts.game_routes import _get_runner
from hearts.game.card import Card


_sid_to_game_id: Dict[str, str] = {}


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

    @socketio.on("disconnect", namespace="/game")
    def on_disconnect():
        _sid_to_game_id.pop(request.sid, None)

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
            emit("error", {"message": "Game is not in playing phase"}, namespace="/game")
            return
        if state.whose_turn == 0:
            emit("error", {"message": "Already human's turn"}, namespace="/game")
            return
        try:
            def on_play(ev):
                emit("play", ev, namespace="/game")

            def on_trick_complete():
                emit("trick_complete", {}, namespace="/game")

            def on_done(s):
                emit("state", s, namespace="/game")

            runner.advance_to_human_turn(
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
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
            def on_play(ev):
                emit("play", ev, namespace="/game")

            def on_trick_complete():
                emit("trick_complete", {}, namespace="/game")

            def on_done(s):
                emit("state", s, namespace="/game")

            runner.submit_play(
                card,
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
            )
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/game")
