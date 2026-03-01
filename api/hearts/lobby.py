"""
In-memory lobby store for multiplayer games.

Each lobby holds up to 4 seats (seat 0 = host). AI seats fill counter-clockwise
from host (3, 2, 1); guests fill clockwise (1, 2, 3) and replace AI seats when
needed. Lobbies expire after 20 minutes of inactivity.
"""

import secrets
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LEN = 6
_EXPIRY_SECONDS = 20 * 60  # 20 minutes
_MAX_CODE_RETRIES = 3

_lobbies: Dict[str, "Lobby"] = {}


@dataclass
class Seat:
    name: str
    player_token: Optional[str] = None
    sid: Optional[str] = None
    is_ai: bool = False
    icon: str = "user"


@dataclass
class Lobby:
    code: str
    host_token: str
    seats: List[Optional[Seat]] = field(default_factory=lambda: [None] * 4)
    player_tokens: Dict[str, int] = field(default_factory=dict)
    status: str = "waiting"  # "waiting" | "playing" | "finished"
    game_id: Optional[str] = None
    last_activity: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    _disconnect_timers: Dict[str, Any] = field(default_factory=dict)

    def touch(self) -> None:
        self.last_activity = time.time()

    def to_dict(self) -> Dict[str, Any]:
        seats = []
        for i, seat in enumerate(self.seats):
            if seat is None:
                seats.append({"index": i, "status": "empty"})
            elif seat.is_ai:
                seats.append(
                    {"index": i, "status": "ai", "name": seat.name, "icon": "robot"}
                )
            else:
                seats.append(
                    {
                        "index": i,
                        "status": "human",
                        "name": seat.name,
                        "icon": seat.icon,
                    }
                )
        return {
            "code": self.code,
            "host_token": self.host_token,
            "seats": seats,
            "status": self.status,
            "game_id": self.game_id,
        }


def _generate_code() -> str:
    return "".join(secrets.choice(_CHARSET) for _ in range(_CODE_LEN))


def cleanup_expired() -> None:
    now = time.time()
    expired = [
        code
        for code, lobby in _lobbies.items()
        if now - lobby.last_activity > _EXPIRY_SECONDS
    ]
    for code in expired:
        _lobbies.pop(code, None)


def create_lobby(host_name: str, num_ai: int = 0, host_icon: str = "user") -> Lobby:
    """Create a new lobby. Host gets seat 0. AI fills counter-clockwise (3, 2, 1)."""
    cleanup_expired()

    code: Optional[str] = None
    for _ in range(_MAX_CODE_RETRIES):
        candidate = _generate_code()
        if candidate not in _lobbies:
            code = candidate
            break
    if code is None:
        raise RuntimeError("Failed to generate unique lobby code")

    host_token = uuid.uuid4().hex
    lobby = Lobby(code=code, host_token=host_token)
    lobby.seats[0] = Seat(name=host_name, player_token=host_token, icon=host_icon)
    lobby.player_tokens[host_token] = 0

    ai_order = [3, 2, 1]
    for i in range(min(num_ai, 3)):
        seat_idx = ai_order[i]
        lobby.seats[seat_idx] = Seat(name=f"Bot {i + 1}", is_ai=True, icon="robot")

    _lobbies[code] = lobby
    return lobby


def get_lobby(code: str) -> Optional[Lobby]:
    lobby = _lobbies.get(code)
    if lobby is None:
        return None
    if time.time() - lobby.last_activity > _EXPIRY_SECONDS:
        _lobbies.pop(code, None)
        return None
    return lobby


def join_lobby(
    code: str, name: str, icon: str = "user", seat_preference: Optional[int] = None
) -> Tuple[int, str]:
    """Join a lobby. Returns (seat_index, player_token). Raises ValueError on failure."""
    lobby = get_lobby(code)
    if lobby is None:
        raise ValueError("Lobby not found")
    if lobby.status != "waiting":
        raise ValueError("Game has already started")

    target: Optional[int] = None

    if seat_preference is not None:
        if seat_preference not in (1, 2, 3):
            raise ValueError("Invalid seat number")
        seat = lobby.seats[seat_preference]
        if seat is None or seat.is_ai:
            target = seat_preference
        else:
            raise ValueError("Seat is already taken")
    else:
        clockwise = [1, 2, 3]
        for idx in clockwise:
            if lobby.seats[idx] is None:
                target = idx
                break
        if target is None:
            for idx in clockwise:
                seat = lobby.seats[idx]
                if seat is not None and seat.is_ai:
                    target = idx
                    break

    if target is None:
        raise ValueError("Lobby is full")

    token = uuid.uuid4().hex
    lobby.seats[target] = Seat(name=name, player_token=token, icon=icon)
    lobby.player_tokens[token] = target
    lobby.touch()
    return target, token


def leave_lobby(code: str, player_token: str) -> Optional[int]:
    """Remove a player from the lobby. Returns the freed seat index, or None."""
    lobby = get_lobby(code)
    if lobby is None:
        return None
    seat_idx = lobby.player_tokens.get(player_token)
    if seat_idx is None:
        return None

    lobby.seats[seat_idx] = None
    del lobby.player_tokens[player_token]
    lobby.touch()

    if player_token == lobby.host_token:
        migrate_host(code)

    return seat_idx


def migrate_host(code: str) -> Optional[str]:
    """Transfer host to the next seated human. Returns new host_token or None."""
    lobby = get_lobby(code)
    if lobby is None:
        return None

    for i in range(4):
        seat = lobby.seats[i]
        if seat is not None and not seat.is_ai and seat.player_token is not None:
            lobby.host_token = seat.player_token
            lobby.touch()
            return seat.player_token

    lobby.status = "finished"
    return None


def close_lobby(code: str, host_token: str) -> bool:
    """Close a lobby (host only). Returns True if closed, False otherwise."""
    lobby = _lobbies.get(code)
    if lobby is None:
        return False
    if lobby.host_token != host_token:
        return False
    if lobby.status != "waiting":
        return False
    _lobbies.pop(code, None)
    return True


def start_game(code: str, difficulty: str) -> str:
    """Validate start conditions and mark lobby as playing. Returns a game_id.

    Empty seats are converted to AI with generic names. The actual
    MultiplayerRunner is created by the socket handler which has access to the
    game engine imports.
    """
    lobby = get_lobby(code)
    if lobby is None:
        raise ValueError("Lobby not found")
    if lobby.status != "waiting":
        raise ValueError("Game has already started")

    bot_num = 1
    for i in range(4):
        if lobby.seats[i] is None:
            lobby.seats[i] = Seat(name=f"Bot {bot_num}", is_ai=True, icon="robot")
            bot_num += 1
        elif lobby.seats[i].is_ai:
            bot_num += 1

    game_id = uuid.uuid4().hex
    lobby.game_id = game_id
    lobby.status = "playing"
    lobby.touch()
    return game_id


def get_all_human_sids(code: str) -> List[Tuple[int, str, str]]:
    """Return list of (seat_index, player_token, sid) for all connected humans."""
    lobby = get_lobby(code)
    if lobby is None:
        return []
    result = []
    for i, seat in enumerate(lobby.seats):
        if seat and not seat.is_ai and seat.player_token and seat.sid:
            result.append((i, seat.player_token, seat.sid))
    return result


def cancel_disconnect_timer(lobby: Lobby, player_token: str) -> None:
    timer = lobby._disconnect_timers.pop(player_token, None)
    if timer is not None:
        timer.cancel()


def reset_store() -> None:
    """Clear all lobbies. For tests only."""
    _lobbies.clear()
