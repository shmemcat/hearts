"""
Tests for game WebSocket: connect with game_id, advance/play emit play, trick_complete, state.
"""

import pytest


@pytest.fixture(autouse=True)
def clear_game_store():
    from hearts.game_routes import reset_store

    reset_store()
    yield
    reset_store()


@pytest.fixture
def socket_env():
    """Provide app, socketio, rest client, and a factory for SocketIO test clients."""
    from hearts import app, socketio
    from hearts.extensions import db

    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
    with app.app_context():
        db.create_all()
        rest = app.test_client()

        def make_socket_client():
            return socketio.test_client(app, flask_test_client=rest)

        yield app, rest, make_socket_client
        db.drop_all()


@pytest.fixture
def socket_client(socket_env):
    """Legacy fixture for backward compat."""
    _, _, make = socket_env
    return make()


def _setup_game_at_phase(rest, target_whose_turn=None, seed_range=60):
    """Start a game, pass, and return (game_id, state) where phase=playing.
    If target_whose_turn is not None, keep trying seeds until whose_turn matches."""
    from hearts.game_routes import reset_store

    for seed in range(seed_range):
        reset_store()
        r = rest.post("/games/start", json={"seed": seed})
        data = r.get_json() if r else None
        if not data or "game_id" not in data:
            continue
        game_id = data["game_id"]
        state = rest.get(f"/games/{game_id}").get_json()
        if state.get("phase") != "passing":
            continue
        three = state["human_hand"][:3]
        rest.post(f"/games/{game_id}/pass", json={"cards": three})
        state = rest.get(f"/games/{game_id}").get_json()
        if state.get("phase") != "playing":
            continue
        if (
            target_whose_turn is not None
            and state.get("whose_turn") != target_whose_turn
        ):
            continue
        return game_id, state
    return None, None


# -----------------------------------------------------------------------------
# WebSocket advance (existing test, refactored)
# -----------------------------------------------------------------------------


def test_ws_advance_emits_play_trick_complete_state(socket_env):
    app, rest, make_socket = socket_env
    game_id, state = _setup_game_at_phase(rest, target_whose_turn=None)
    if game_id is None:
        pytest.fail("No seed gave playing phase")
    if state["whose_turn"] == 0:
        game_id, state = _setup_game_at_phase(rest, target_whose_turn=1, seed_range=80)
        if game_id is None:
            game_id, state = _setup_game_at_phase(
                rest, target_whose_turn=2, seed_range=80
            )
        if game_id is None:
            game_id, state = _setup_game_at_phase(
                rest, target_whose_turn=3, seed_range=80
            )
    if game_id is None or state["whose_turn"] == 0:
        pytest.fail("No seed gave AI lead after pass")
    client = make_socket()
    client.connect(namespace="/game", query_string=f"game_id={game_id}")
    client.get_received("/game")
    if not client.is_connected("/game"):
        pytest.fail("Socket failed to connect")
    client.emit("advance", namespace="/game")
    received = client.get_received("/game")
    play_events = [r for r in received if r.get("name") == "play"]
    state_events = [r for r in received if r.get("name") == "state"]
    assert len(state_events) == 1, repr(received)
    assert state_events[0].get("args") and len(state_events[0]["args"]) == 1
    state_payload = state_events[0]["args"][0]
    assert (
        state_payload.get("whose_turn") == 0 or state_payload.get("phase") == "passing"
    )
    assert len(play_events) >= 1


# -----------------------------------------------------------------------------
# WebSocket play event tests
# -----------------------------------------------------------------------------


class TestWSPlay:
    def test_play_emits_correct_event_order(self, socket_env):
        """WS play should emit: play (human) -> [play (AI)]... -> state."""
        app, rest, make_socket = socket_env
        game_id, state = _setup_game_at_phase(rest, target_whose_turn=0, seed_range=80)
        if game_id is None:
            pytest.fail("No seed gave human lead after pass")
        legal = state.get("legal_plays", [])
        assert len(legal) > 0
        client = make_socket()
        client.connect(namespace="/game", query_string=f"game_id={game_id}")
        client.get_received("/game")
        assert client.is_connected("/game")
        client.emit("play", {"card": legal[0]}, namespace="/game")
        received = client.get_received("/game")
        play_events = [r for r in received if r.get("name") == "play"]
        state_events = [r for r in received if r.get("name") == "state"]
        error_events = [r for r in received if r.get("name") == "error"]
        assert len(error_events) == 0, f"Unexpected errors: {error_events}"
        assert len(play_events) >= 1, "Should have at least the human play"
        assert play_events[0]["args"][0]["player_index"] == 0
        assert play_events[0]["args"][0]["card"] == legal[0]
        assert (
            len(state_events) == 1
        ), f"Expected exactly 1 state event, got {len(state_events)}"
        state_payload = state_events[0]["args"][0]
        assert (
            state_payload.get("whose_turn") == 0
            or state_payload.get("phase") == "passing"
        )
        # State is the last event
        last_event = received[-1]
        assert last_event.get("name") == "state"

    def test_play_invalid_card_returns_error(self, socket_env):
        """WS play with an invalid card code should emit an error event."""
        app, rest, make_socket = socket_env
        game_id, state = _setup_game_at_phase(rest, target_whose_turn=0, seed_range=80)
        if game_id is None:
            pytest.fail("No seed gave human lead after pass")
        client = make_socket()
        client.connect(namespace="/game", query_string=f"game_id={game_id}")
        client.get_received("/game")
        assert client.is_connected("/game")
        client.emit("play", {"card": "xx"}, namespace="/game")
        received = client.get_received("/game")
        error_events = [r for r in received if r.get("name") == "error"]
        assert len(error_events) == 1
        assert "args" in error_events[0]
        assert "message" in error_events[0]["args"][0]

    def test_play_wrong_turn_returns_error(self, socket_env):
        """WS play when it's not the human's turn should emit an error."""
        app, rest, make_socket = socket_env
        game_id, state = _setup_game_at_phase(rest, target_whose_turn=1, seed_range=80)
        if game_id is None:
            game_id, state = _setup_game_at_phase(
                rest, target_whose_turn=2, seed_range=80
            )
        if game_id is None:
            game_id, state = _setup_game_at_phase(
                rest, target_whose_turn=3, seed_range=80
            )
        if game_id is None:
            pytest.fail("No seed gave AI lead after pass")
        client = make_socket()
        client.connect(namespace="/game", query_string=f"game_id={game_id}")
        client.get_received("/game")
        assert client.is_connected("/game")
        client.emit("play", {"card": state["human_hand"][0]}, namespace="/game")
        received = client.get_received("/game")
        error_events = [r for r in received if r.get("name") == "error"]
        assert len(error_events) == 1
        msg = error_events[0]["args"][0]["message"].lower()
        assert "turn" in msg or "not your" in msg

    def test_play_missing_card_returns_error(self, socket_env):
        """WS play without a card field should emit an error."""
        app, rest, make_socket = socket_env
        game_id, state = _setup_game_at_phase(rest, target_whose_turn=0, seed_range=80)
        if game_id is None:
            pytest.fail("No seed gave human lead after pass")
        client = make_socket()
        client.connect(namespace="/game", query_string=f"game_id={game_id}")
        client.get_received("/game")
        assert client.is_connected("/game")
        client.emit("play", {}, namespace="/game")
        received = client.get_received("/game")
        error_events = [r for r in received if r.get("name") == "error"]
        assert len(error_events) == 1
        assert "card" in error_events[0]["args"][0]["message"].lower()
