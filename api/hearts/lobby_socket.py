"""
WebSocket handlers for the /lobby namespace.

Handles real-time lobby seat management: connect, join, leave, start_game,
disconnect with host migration timers.
"""

import eventlet
from typing import Dict, Optional, Tuple

from flask import request
from flask_socketio import emit, join_room, leave_room

from hearts.lobby import (
    Lobby,
    get_lobby,
    join_lobby,
    leave_lobby,
    migrate_host,
    start_game,
    cancel_disconnect_timer,
    get_all_human_sids,
)
from hearts.multiplayer_socket import create_multiplayer_game

_HOST_DISCONNECT_SECONDS = 30
_GUEST_DISCONNECT_SECONDS = 30

# SID -> (lobby_code, player_token or None)
_sid_to_lobby: Dict[str, Tuple[str, Optional[str]]] = {}


def _broadcast_lobby_update(lobby: Lobby) -> None:
    emit(
        "lobby_update", lobby.to_dict(), room=f"lobby:{lobby.code}", namespace="/lobby"
    )


def _emit_lobby_update_to(lobby: Lobby, sid: str) -> None:
    emit("lobby_update", lobby.to_dict(), to=sid, namespace="/lobby")


def register_lobby_socket(socketio):

    @socketio.on("connect", namespace="/lobby")
    def on_connect():
        code = (request.args.get("lobby_code") or "").strip().upper()
        player_token = (request.args.get("player_token") or "").strip() or None

        if not code:
            return False

        lobby = get_lobby(code)
        if lobby is None:
            emit("error", {"message": "Lobby not found"}, namespace="/lobby")
            return False

        join_room(f"lobby:{code}")
        _sid_to_lobby[request.sid] = (code, player_token)

        # Reconnect: if player_token matches a seat, restore their SID
        if player_token and player_token in lobby.player_tokens:
            seat_idx = lobby.player_tokens[player_token]
            seat = lobby.seats[seat_idx]
            if seat and not seat.is_ai:
                seat.sid = request.sid
                cancel_disconnect_timer(lobby, player_token)
                lobby.touch()
                _broadcast_lobby_update(lobby)
                return

        # Update SID for host on first connect
        if player_token and player_token == lobby.host_token:
            seat = lobby.seats[0]
            if seat:
                seat.sid = request.sid

        _emit_lobby_update_to(lobby, request.sid)

    @socketio.on("disconnect", namespace="/lobby")
    def on_disconnect():
        info = _sid_to_lobby.pop(request.sid, None)
        if info is None:
            return
        code, player_token = info

        lobby = get_lobby(code)
        if lobby is None or lobby.status != "waiting":
            return
        if player_token is None:
            return

        seat_idx = lobby.player_tokens.get(player_token)
        if seat_idx is None:
            return

        is_host = player_token == lobby.host_token
        timeout = _HOST_DISCONNECT_SECONDS if is_host else _GUEST_DISCONNECT_SECONDS

        def _on_timeout():
            lobby2 = get_lobby(code)
            if lobby2 is None:
                return
            tok_seat = lobby2.player_tokens.get(player_token)
            if tok_seat is None:
                return
            seat = lobby2.seats[tok_seat]
            if seat is None or seat.sid != request.sid:
                # They reconnected with a new SID already
                return

            lobby2.seats[tok_seat] = None
            lobby2.player_tokens.pop(player_token, None)
            lobby2._disconnect_timers.pop(player_token, None)

            if is_host:
                new_host = migrate_host(code)
                if new_host is None:
                    socketio.emit(
                        "lobby_closed", {}, room=f"lobby:{code}", namespace="/lobby"
                    )
                    return

            lobby2.touch()
            socketio.emit(
                "lobby_update",
                lobby2.to_dict(),
                room=f"lobby:{code}",
                namespace="/lobby",
            )

        timer = eventlet.spawn_after(timeout, _on_timeout)
        lobby._disconnect_timers[player_token] = timer

    @socketio.on("join", namespace="/lobby")
    def on_join(data):
        info = _sid_to_lobby.get(request.sid)
        if info is None:
            emit("error", {"message": "Not connected to a lobby"}, namespace="/lobby")
            return
        code, _ = info
        name = (data.get("name") if isinstance(data, dict) else "") or ""
        name = name.strip()
        if not name:
            emit("error", {"message": "Name is required"}, namespace="/lobby")
            return

        try:
            seat_idx, token = join_lobby(code, name)
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/lobby")
            return

        lobby = get_lobby(code)
        if lobby is None:
            return
        seat = lobby.seats[seat_idx]
        if seat:
            seat.sid = request.sid

        _sid_to_lobby[request.sid] = (code, token)

        emit(
            "join_ack",
            {"seat_index": seat_idx, "player_token": token},
            namespace="/lobby",
        )
        _broadcast_lobby_update(lobby)

    @socketio.on("leave", namespace="/lobby")
    def on_leave():
        info = _sid_to_lobby.get(request.sid)
        if info is None:
            return
        code, player_token = info
        if player_token is None:
            return

        freed = leave_lobby(code, player_token)
        if freed is None:
            return

        lobby = get_lobby(code)
        if lobby is None:
            socketio.emit("lobby_closed", {}, room=f"lobby:{code}", namespace="/lobby")
        else:
            _broadcast_lobby_update(lobby)

        _sid_to_lobby[request.sid] = (code, None)

    @socketio.on("start_game", namespace="/lobby")
    def on_start_game(data):
        info = _sid_to_lobby.get(request.sid)
        if info is None:
            emit("error", {"message": "Not connected to a lobby"}, namespace="/lobby")
            return
        code, player_token = info
        if player_token is None:
            emit("error", {"message": "You are not in this lobby"}, namespace="/lobby")
            return

        lobby = get_lobby(code)
        if lobby is None:
            emit("error", {"message": "Lobby not found"}, namespace="/lobby")
            return
        if player_token != lobby.host_token:
            emit(
                "error",
                {"message": "Only the host can start the game"},
                namespace="/lobby",
            )
            return

        difficulty = (
            data.get("difficulty") if isinstance(data, dict) else "easy"
        ) or "easy"

        try:
            game_id = start_game(code, difficulty)
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/lobby")
            return

        # Build seats data for the multiplayer runner
        seats_data = []
        for i, seat in enumerate(lobby.seats):
            if seat is None:
                seats_data.append(
                    {"name": f"Bot {i}", "is_ai": True, "player_token": None}
                )
            else:
                seats_data.append(
                    {
                        "name": seat.name,
                        "is_ai": seat.is_ai,
                        "player_token": seat.player_token,
                    }
                )

        create_multiplayer_game(game_id, code, difficulty, seats_data, socketio)

        seat_assignments = []
        for i, seat in enumerate(lobby.seats):
            if seat and not seat.is_ai and seat.player_token:
                seat_assignments.append(
                    {
                        "seat_index": i,
                        "player_token": seat.player_token,
                    }
                )

        emit(
            "game_started",
            {
                "game_id": game_id,
                "difficulty": difficulty,
                "seat_assignments": seat_assignments,
                "seats": lobby.to_dict()["seats"],
            },
            room=f"lobby:{code}",
            namespace="/lobby",
        )
