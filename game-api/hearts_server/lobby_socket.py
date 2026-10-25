"""
WebSocket handlers for the /lobby namespace.

Handles real-time lobby seat management: connect, join, leave, start_game,
disconnect with host migration timers.
"""

from hearts_server.runtime import runtime_state

import eventlet
from typing import Dict, Optional, Tuple

from flask import request
from flask_socketio import emit, join_room, leave_room

from hearts_server.lobby import (
    Lobby,
    get_lobby,
    join_lobby,
    leave_lobby,
    close_lobby,
    start_game,
    cancel_disconnect_timer,
    get_all_human_sids,
)
from hearts_server.multiplayer_socket import create_multiplayer_game
from hearts_server.game_accounts import game_lock
from hearts_server.jwt_utils import get_current_user

_HOST_DISCONNECT_SECONDS = 30
_GUEST_DISCONNECT_SECONDS = 30

# SID -> (lobby_code, player_token or None)
_sid_to_lobby: Dict[str, Tuple[str, Optional[str]]] = runtime_state(
    "hearts_server.lobby_sids"
)


def _broadcast_lobby_update(lobby: Lobby) -> None:
    emit(
        "lobby_update", lobby.to_dict(), room=f"lobby:{lobby.code}", namespace="/lobby"
    )


def _emit_lobby_update_to(lobby: Lobby, sid: str) -> None:
    emit("lobby_update", lobby.to_dict(), to=sid, namespace="/lobby")


def lobby_player_connected(code: str, player_token: str) -> bool:
    from hearts_server.multiplayer_socket import _sid_to_game

    return any(info == (code, player_token) for info in _sid_to_lobby.values()) or any(
        info.get("lobby_code") == code and info.get("player_token") == player_token
        for info in _sid_to_game.values()
    )


def schedule_lobby_disconnect(lobby: Lobby, player_token: str, socketio, app) -> None:
    """Retire a waiting seat after its last lobby or results connection leaves."""
    if lobby.status != "waiting" or player_token not in lobby.player_tokens:
        return
    if lobby_player_connected(lobby.code, player_token):
        return
    if player_token in lobby._disconnect_timers:
        return
    code = lobby.code
    timeout = (
        _HOST_DISCONNECT_SECONDS
        if player_token == lobby.host_token
        else _GUEST_DISCONNECT_SECONDS
    )

    def on_timeout():
        with app.app_context(), game_lock():
            current = get_lobby(code)
            if current is not lobby or lobby.status != "waiting":
                return
            if lobby._disconnect_timers.get(player_token) is not timer:
                return
            lobby._disconnect_timers.pop(player_token, None)
            if lobby_player_connected(code, player_token):
                return
            if leave_lobby(code, player_token) is None:
                return
            if lobby.status == "finished":
                socketio.emit(
                    "lobby_closed", {}, room=f"lobby:{code}", namespace="/lobby"
                )
            else:
                socketio.emit(
                    "lobby_update",
                    lobby.to_dict(),
                    room=f"lobby:{code}",
                    namespace="/lobby",
                )

    timer = eventlet.spawn_after(timeout, on_timeout)
    lobby._disconnect_timers[player_token] = timer


def register_lobby_socket(socketio, app):

    @socketio.on("connect", namespace="/lobby")
    def on_connect(auth=None):
        # Namespace auth is refreshed on every reconnect. Transport query
        # parameters can belong to an earlier namespace/session.
        credentials = auth if isinstance(auth, dict) else request.args
        raw_code = credentials.get("lobby_code")
        raw_token = credentials.get("player_token")
        code = raw_code.strip().upper() if isinstance(raw_code, str) else ""
        player_token = raw_token.strip() if isinstance(raw_token, str) else None

        if not code:
            return False

        lobby = get_lobby(code)
        if lobby is None:
            emit("error", {"message": "Lobby not found"}, namespace="/lobby")
            return False

        join_room(f"lobby:{code}")
        _sid_to_lobby[request.sid] = (code, None)

        if lobby.status == "finished":
            emit("lobby_closed", {}, namespace="/lobby")
            return

        # Reconnect: if player_token matches a seat, restore their SID
        if player_token and player_token in lobby.player_tokens:
            seat_idx = lobby.player_tokens[player_token]
            seat = lobby.seats[seat_idx]
            if seat and not seat.is_ai:
                user = get_current_user()
                if (
                    app.extensions.get("remote_accounts_enabled")
                    and seat.user_id
                    and (not user or user.id != seat.user_id)
                ):
                    return False
                _sid_to_lobby[request.sid] = (code, player_token)
                seat.sid = request.sid
                user = get_current_user()
                if user:
                    seat.user_id = user.id
                cancel_disconnect_timer(lobby, player_token)
                lobby.touch()
                emit(
                    "lobby_session",
                    {"seat_index": seat_idx, "player_token": player_token},
                    namespace="/lobby",
                )
                _broadcast_lobby_update(lobby)
                return

        emit(
            "lobby_session",
            {"seat_index": None, "player_token": None},
            namespace="/lobby",
        )
        _emit_lobby_update_to(lobby, request.sid)

    @socketio.on("disconnect", namespace="/lobby")
    def on_disconnect():
        sid = request.sid
        info = _sid_to_lobby.pop(sid, None)
        if info is None:
            return
        code, player_token = info

        lobby = get_lobby(code)
        if lobby is None or lobby.status != "waiting":
            return
        if player_token is None:
            return

        schedule_lobby_disconnect(lobby, player_token, socketio, app)

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
        icon = (data.get("icon") if isinstance(data, dict) else "") or "user"
        raw_seat = data.get("seat_preference") if isinstance(data, dict) else None
        try:
            seat_preference = int(raw_seat) if raw_seat is not None else None
        except (ValueError, TypeError):
            seat_preference = None

        try:
            seat_idx, token = join_lobby(
                code, name, icon=icon, seat_preference=seat_preference
            )
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/lobby")
            return

        lobby = get_lobby(code)
        if lobby is None:
            return
        seat = lobby.seats[seat_idx]
        if seat:
            seat.sid = request.sid
            user = get_current_user()
            seat.user_id = user.id if user else None

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
        if lobby is None or lobby.status == "finished":
            socketio.emit("lobby_closed", {}, room=f"lobby:{code}", namespace="/lobby")
        else:
            _broadcast_lobby_update(lobby)

        _sid_to_lobby[request.sid] = (code, None)

    @socketio.on("close_lobby", namespace="/lobby")
    def on_close_lobby():
        info = _sid_to_lobby.get(request.sid)
        if info is None:
            return
        code, player_token = info
        if player_token is None:
            emit("error", {"message": "You are not in this lobby"}, namespace="/lobby")
            return

        if not close_lobby(code, player_token):
            emit(
                "error",
                {"message": "Only the host can close the lobby"},
                namespace="/lobby",
            )
            return

        socketio.emit("lobby_closed", {}, room=f"lobby:{code}", namespace="/lobby")

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
                        "icon": seat.icon,
                        "user_id": seat.user_id,
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

        game_payload = {
            "game_id": game_id,
            "difficulty": difficulty,
            "seat_assignments": seat_assignments,
            "seats": lobby.to_dict()["seats"],
        }

        emit(
            "game_started",
            game_payload,
            room=f"lobby:{code}",
            namespace="/lobby",
        )

        if lobby.previous_game_id:
            socketio.emit(
                "play_again_started",
                game_payload,
                room=f"game:{lobby.previous_game_id}",
                namespace="/multi",
            )
            lobby.previous_game_id = None
