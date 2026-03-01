"""Tests for lobby management functions."""

import time
import pytest

from hearts.lobby import (
    create_lobby,
    get_lobby,
    join_lobby,
    leave_lobby,
    migrate_host,
    start_game,
    cleanup_expired,
    reset_store,
    _EXPIRY_SECONDS,
)


@pytest.fixture(autouse=True)
def clean_store():
    reset_store()
    yield
    reset_store()


class TestCreateLobby:
    def test_creates_with_host_at_seat_0(self):
        lobby = create_lobby("Alice")
        assert lobby.seats[0] is not None
        assert lobby.seats[0].name == "Alice"
        assert lobby.seats[0].player_token == lobby.host_token
        assert lobby.status == "waiting"

    def test_unique_6_char_code(self):
        lobby = create_lobby("Alice")
        assert len(lobby.code) == 6
        assert lobby.code.isalnum()

    def test_host_token_mapped(self):
        lobby = create_lobby("Alice")
        assert lobby.player_tokens[lobby.host_token] == 0

    def test_ai_fills_counter_clockwise(self):
        lobby = create_lobby("Host", num_ai=2)
        assert lobby.seats[3] is not None
        assert lobby.seats[3].is_ai
        assert lobby.seats[3].name == "Bot 1"
        assert lobby.seats[2] is not None
        assert lobby.seats[2].is_ai
        assert lobby.seats[2].name == "Bot 2"
        assert lobby.seats[1] is None

    def test_max_3_ai(self):
        lobby = create_lobby("Host", num_ai=5)
        ai_count = sum(1 for s in lobby.seats if s and s.is_ai)
        assert ai_count == 3


class TestJoinLobby:
    def test_guest_fills_clockwise(self):
        lobby = create_lobby("Host")
        idx, token = join_lobby(lobby.code, "Alice")
        assert idx == 1
        assert lobby.seats[1].name == "Alice"
        idx2, _ = join_lobby(lobby.code, "Bob")
        assert idx2 == 2

    def test_returns_seat_and_token(self):
        lobby = create_lobby("Host")
        idx, token = join_lobby(lobby.code, "Guest")
        assert isinstance(idx, int)
        assert isinstance(token, str)
        assert len(token) == 32  # uuid hex

    def test_guest_replaces_ai(self):
        lobby = create_lobby("Host", num_ai=3)
        idx, _ = join_lobby(lobby.code, "Human")
        assert idx == 1
        assert not lobby.seats[1].is_ai
        assert lobby.seats[1].name == "Human"

    def test_raises_for_full_lobby(self):
        lobby = create_lobby("Host")
        join_lobby(lobby.code, "A")
        join_lobby(lobby.code, "B")
        join_lobby(lobby.code, "C")
        with pytest.raises(ValueError, match="full"):
            join_lobby(lobby.code, "D")

    def test_seat_preference_selects_specific_seat(self):
        lobby = create_lobby("Host")
        idx, _ = join_lobby(lobby.code, "Alice", seat_preference=3)
        assert idx == 3
        assert lobby.seats[3].name == "Alice"

    def test_seat_preference_replaces_ai(self):
        lobby = create_lobby("Host", num_ai=2)
        idx, _ = join_lobby(lobby.code, "Alice", seat_preference=3)
        assert idx == 3
        assert lobby.seats[3].name == "Alice"
        assert not lobby.seats[3].is_ai

    def test_seat_preference_raises_for_taken_seat(self):
        lobby = create_lobby("Host")
        join_lobby(lobby.code, "Alice", seat_preference=2)
        with pytest.raises(ValueError, match="already taken"):
            join_lobby(lobby.code, "Bob", seat_preference=2)

    def test_seat_preference_raises_for_invalid_number(self):
        lobby = create_lobby("Host")
        with pytest.raises(ValueError, match="Invalid seat"):
            join_lobby(lobby.code, "Alice", seat_preference=0)
        with pytest.raises(ValueError, match="Invalid seat"):
            join_lobby(lobby.code, "Bob", seat_preference=5)

    def test_raises_for_nonexistent_lobby(self):
        with pytest.raises(ValueError, match="not found"):
            join_lobby("ZZZZZZ", "Test")

    def test_raises_for_started_lobby(self):
        lobby = create_lobby("Host")
        start_game(lobby.code, "easy")
        with pytest.raises(ValueError, match="already started"):
            join_lobby(lobby.code, "Late")


class TestLeaveLobby:
    def test_removes_player(self):
        lobby = create_lobby("Host")
        _, token = join_lobby(lobby.code, "Guest")
        freed = leave_lobby(lobby.code, token)
        assert freed == 1
        assert lobby.seats[1] is None

    def test_clears_token_mapping(self):
        lobby = create_lobby("Host")
        _, token = join_lobby(lobby.code, "Guest")
        leave_lobby(lobby.code, token)
        assert token not in lobby.player_tokens

    def test_returns_none_for_unknown_token(self):
        lobby = create_lobby("Host")
        result = leave_lobby(lobby.code, "nonexistent_token")
        assert result is None

    def test_host_leave_triggers_migration(self):
        lobby = create_lobby("Host")
        _, guest_token = join_lobby(lobby.code, "Guest")
        leave_lobby(lobby.code, lobby.host_token)
        assert lobby.host_token == guest_token


class TestMigrateHost:
    def test_transfers_to_next_human(self):
        lobby = create_lobby("Host")
        _, guest_token = join_lobby(lobby.code, "Guest")
        old_host = lobby.host_token
        leave_lobby(lobby.code, old_host)
        assert lobby.host_token == guest_token

    def test_returns_new_host_token(self):
        lobby = create_lobby("Host")
        _, guest_token = join_lobby(lobby.code, "Guest")
        old_host = lobby.host_token
        lobby.seats[0] = None
        del lobby.player_tokens[old_host]
        new_token = migrate_host(lobby.code)
        assert new_token == guest_token

    def test_finishes_lobby_if_no_humans(self):
        lobby = create_lobby("Host", num_ai=3)
        lobby.seats[0] = None
        del lobby.player_tokens[lobby.host_token]
        result = migrate_host(lobby.code)
        assert result is None
        assert lobby.status == "finished"


class TestStartGame:
    def test_fills_empty_seats_with_bots(self):
        lobby = create_lobby("Host")
        join_lobby(lobby.code, "Guest")
        start_game(lobby.code, "easy")
        assert lobby.seats[2] is not None
        assert lobby.seats[2].is_ai
        assert lobby.seats[3] is not None
        assert lobby.seats[3].is_ai

    def test_marks_status_playing(self):
        lobby = create_lobby("Host")
        start_game(lobby.code, "easy")
        assert lobby.status == "playing"

    def test_returns_game_id(self):
        lobby = create_lobby("Host")
        game_id = start_game(lobby.code, "easy")
        assert isinstance(game_id, str)
        assert len(game_id) == 32
        assert lobby.game_id == game_id

    def test_raises_for_nonexistent(self):
        with pytest.raises(ValueError, match="not found"):
            start_game("ZZZZZZ", "easy")

    def test_raises_for_already_started(self):
        lobby = create_lobby("Host")
        start_game(lobby.code, "easy")
        with pytest.raises(ValueError, match="already started"):
            start_game(lobby.code, "easy")


class TestExpiration:
    def test_get_lobby_returns_none_for_expired(self):
        lobby = create_lobby("Host")
        lobby.last_activity = time.time() - _EXPIRY_SECONDS - 1
        assert get_lobby(lobby.code) is None

    def test_cleanup_expired_removes_stale(self):
        lobby = create_lobby("Host")
        code = lobby.code
        lobby.last_activity = time.time() - _EXPIRY_SECONDS - 1
        cleanup_expired()
        assert get_lobby(code) is None

    def test_active_lobby_not_expired(self):
        lobby = create_lobby("Host")
        lobby.last_activity = time.time()
        assert get_lobby(lobby.code) is not None


class TestToDict:
    def test_serializes_lobby(self):
        lobby = create_lobby("Host", num_ai=1)
        join_lobby(lobby.code, "Guest")
        d = lobby.to_dict()
        assert d["code"] == lobby.code
        assert d["status"] == "waiting"
        assert len(d["seats"]) == 4
        assert d["seats"][0]["status"] == "human"
        assert d["seats"][0]["name"] == "Host"

    def test_empty_seats_shown(self):
        lobby = create_lobby("Host")
        d = lobby.to_dict()
        assert d["seats"][1]["status"] == "empty"
        assert d["seats"][2]["status"] == "empty"

    def test_ai_seats_shown(self):
        lobby = create_lobby("Host", num_ai=1)
        d = lobby.to_dict()
        assert d["seats"][3]["status"] == "ai"
        assert d["seats"][3]["name"] == "Bot 1"

    def test_no_raw_player_tokens_exposed(self):
        lobby = create_lobby("Host")
        join_lobby(lobby.code, "Guest")
        d = lobby.to_dict()
        for seat in d["seats"]:
            assert "player_token" not in seat
