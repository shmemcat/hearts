
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
def socket_client():
    from hearts import app, socketio
    app.config["TESTING"] = True
    return socketio.test_client(app, flask_test_client=app.test_client())


def test_ws_advance_emits_play_trick_complete_state(socket_client):
    from hearts import app
    app.config["TESTING"] = True
    rest = app.test_client()
    for seed in range(60):
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
        if state.get("phase") != "playing" or state.get("whose_turn") == 0:
            continue
        client = socket_client
        client.connect(namespace="/game", query_string=f"game_id={game_id}")
        received = client.get_received("/game")
        if not client.is_connected("/game"):
            continue
        client.emit("advance", namespace="/game")
        received = client.get_received("/game")
        play_events = [r for r in received if r.get("name") == "play"]
        trick_events = [r for r in received if r.get("name") == "trick_complete"]
        state_events = [r for r in received if r.get("name") == "state"]
        assert len(state_events) == 1, repr(received)
        assert state_events[0].get("args") and len(state_events[0]["args"]) == 1
        state_payload = state_events[0]["args"][0]
        assert state_payload.get("whose_turn") == 0 or state_payload.get("phase") == "passing"
        assert len(play_events) >= 1
        return
    pytest.fail("No seed gave AI lead after pass")
