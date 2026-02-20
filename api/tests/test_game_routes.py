"""
API route tests for game endpoints: POST /games/start, GET /games/<id>, POST pass,
POST /games/<id>/advance, POST play.
"""

import pytest
from unittest.mock import patch


def _register_verified(client, username, email, password="password123"):
    """Register a user and immediately verify their email."""
    from hearts.extensions import db
    from hearts.models import User
    with patch("hearts.auth_routes.send_verification_email"):
        client.post("/register", json={
            "username": username, "email": email, "password": password,
        })
    user = User.query.filter_by(username=username).first()
    user.email_verified = True
    user.verification_token = None
    user.verification_expires = None
    db.session.commit()


@pytest.fixture(autouse=True)
def clear_game_store():
    """Clear in-memory game store before and after each test in this module."""
    from hearts.game_routes import reset_store
    reset_store()
    yield
    reset_store()


# -----------------------------------------------------------------------------
# POST /games/start
# -----------------------------------------------------------------------------

class TestStartGame:
    def test_start_returns_201_and_game_id(self, client):
        r = client.post(
            "/games/start",
            json={},
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 201
        data = r.get_json()
        assert "game_id" in data
        assert isinstance(data["game_id"], str)
        assert len(data["game_id"]) == 32

    def test_start_accepts_player_name(self, client):
        r = client.post(
            "/games/start",
            json={"player_name": "Alice"},
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code == 201
        game_id = r.get_json()["game_id"]
        get_r = client.get(f"/games/{game_id}")
        assert get_r.status_code == 200
        state = get_r.get_json()
        assert state["players"][0]["name"] == "Alice"

    def test_start_state_has_passing_phase_and_13_cards(self, client):
        r = client.post("/games/start", json={})
        assert r.status_code == 201
        game_id = r.get_json()["game_id"]
        get_r = client.get(f"/games/{game_id}")
        assert get_r.status_code == 200
        state = get_r.get_json()
        assert state["phase"] == "passing"
        assert state["round"] == 1
        assert len(state["human_hand"]) == 13
        assert len(state["players"]) == 4


# -----------------------------------------------------------------------------
# GET /games/<game_id>
# -----------------------------------------------------------------------------

class TestGetGame:
    def test_get_nonexistent_returns_404(self, client):
        r = client.get("/games/nonexistent-id-12345")
        assert r.status_code == 404
        data = r.get_json()
        assert "error" in data
        assert "not found" in data["error"].lower()

    def test_get_after_start_returns_full_state(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.get(f"/games/{game_id}")
        assert r.status_code == 200
        state = r.get_json()
        assert "phase" in state
        assert "round" in state
        assert "human_hand" in state
        assert "players" in state
        assert "current_trick" in state
        assert "pass_direction" in state


# -----------------------------------------------------------------------------
# POST /games/<game_id>/pass
# -----------------------------------------------------------------------------

class TestSubmitPass:
    def test_pass_nonexistent_game_returns_404(self, client):
        r = client.post(
            "/games/bad-id/pass",
            json={"cards": ["2c", "3c", "4c"]},
        )
        assert r.status_code == 404

    def test_pass_wrong_count_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(
            f"/games/{game_id}/pass",
            json={"cards": ["2c", "3c"]},
        )
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_pass_invalid_card_code_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(
            f"/games/{game_id}/pass",
            json={"cards": ["2c", "3c", "invalid"]},
        )
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_pass_valid_three_cards_transitions_to_playing(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        state = client.get(f"/games/{game_id}").get_json()
        hand = state["human_hand"]
        assert len(hand) == 13
        three_cards = hand[:3]
        r = client.post(
            f"/games/{game_id}/pass",
            json={"cards": three_cards},
        )
        assert r.status_code == 200
        data = r.get_json()
        assert data["phase"] == "playing"
        # After pass, each player still has 13 cards (gave 3, received 3)
        assert len(data["human_hand"]) == 13


# -----------------------------------------------------------------------------
# POST /games/<game_id>/advance
# -----------------------------------------------------------------------------

class TestAdvanceGame:
    def test_advance_nonexistent_returns_404(self, client):
        r = client.post("/games/bad-id/advance")
        assert r.status_code == 404
        data = r.get_json()
        assert "error" in data
        assert "not found" in data["error"].lower()

    def test_advance_while_passing_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(f"/games/{game_id}/advance")
        assert r.status_code == 400
        data = r.get_json()
        assert "error" in data
        assert "playing" in data["error"].lower() or "phase" in data["error"].lower()

    def test_advance_when_human_turn_returns_400(self, client):
        from hearts.game_routes import reset_store
        for seed in range(50):
            reset_store()
            start_r = client.post("/games/start", json={"seed": seed})
            game_id = start_r.get_json()["game_id"]
            state = client.get(f"/games/{game_id}").get_json()
            three_cards = state["human_hand"][:3]
            client.post(f"/games/{game_id}/pass", json={"cards": three_cards})
            state = client.get(f"/games/{game_id}").get_json()
            if state["phase"] != "playing" or state["whose_turn"] != 0:
                continue
            r = client.post(f"/games/{game_id}/advance")
            assert r.status_code == 400, r.get_json()
            data = r.get_json()
            assert "error" in data
            assert "human" in data["error"].lower() or "turn" in data["error"].lower()
            return
        pytest.fail("No seed in 0..49 gave human the lead after pass")

    def test_advance_when_ai_turn_returns_200_and_advances_to_human_or_pass(self, client):
        from hearts.game_routes import reset_store
        for seed in range(50):
            reset_store()
            start_r = client.post("/games/start", json={"seed": seed})
            game_id = start_r.get_json()["game_id"]
            state = client.get(f"/games/{game_id}").get_json()
            three_cards = state["human_hand"][:3]
            client.post(f"/games/{game_id}/pass", json={"cards": three_cards})
            state = client.get(f"/games/{game_id}").get_json()
            if state["phase"] != "playing" or state["whose_turn"] == 0:
                continue
            r = client.post(f"/games/{game_id}/advance")
            assert r.status_code == 200, r.get_json()
            data = r.get_json()
            assert "phase" in data
            assert "intermediate_plays" in data
            assert "round_just_ended" in data
            assert isinstance(data["intermediate_plays"], list)
            if data["phase"] == "playing":
                assert data["whose_turn"] == 0
            else:
                assert data["phase"] == "passing"
            return
        pytest.fail("No seed in 0..49 gave AI the lead after pass")


# -----------------------------------------------------------------------------
# POST /games/<game_id>/play
# -----------------------------------------------------------------------------

class TestSubmitPlay:
    def test_play_nonexistent_game_returns_404(self, client):
        r = client.post(
            "/games/bad-id/play",
            json={"card": "2c"},
        )
        assert r.status_code == 404

    def test_play_missing_card_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(
            f"/games/{game_id}/play",
            json={},
        )
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_play_invalid_card_code_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(
            f"/games/{game_id}/play",
            json={"card": "xx"},
        )
        assert r.status_code == 400
        assert "error" in r.get_json()

    def test_play_while_still_passing_returns_400(self, client):
        start_r = client.post("/games/start", json={})
        game_id = start_r.get_json()["game_id"]
        r = client.post(
            f"/games/{game_id}/play",
            json={"card": "2c"},
        )
        assert r.status_code == 400
        data = r.get_json()
        assert "error" in data
        assert "pass" in data["error"].lower() or "phase" in data["error"].lower()

    def test_pass_then_play_legal_card_returns_200_and_updates_state(self, client):
        # With TESTING=true, "seed" gives deterministic game. Try seeds until human leads after pass.
        from hearts.game_routes import reset_store
        for seed in range(50):
            reset_store()
            start_r = client.post("/games/start", json={"seed": seed})
            game_id = start_r.get_json()["game_id"]
            state = client.get(f"/games/{game_id}").get_json()
            three_cards = state["human_hand"][:3]
            client.post(f"/games/{game_id}/pass", json={"cards": three_cards})
            state = client.get(f"/games/{game_id}").get_json()
            if state["phase"] != "playing":
                continue
            legal = state.get("legal_plays", [])
            if not legal:
                continue
            card_to_play = legal[0]
            r = client.post(
                f"/games/{game_id}/play",
                json={"card": card_to_play},
            )
            assert r.status_code == 200, r.get_json()
            data = r.get_json()
            # One card played, so 13 - 1 = 12
            assert len(data["human_hand"]) == 12
            return
        pytest.fail("No seed in 0..49 gave human the lead after pass")


# -----------------------------------------------------------------------------
# POST /games/<game_id>/concede
# -----------------------------------------------------------------------------

class TestConcedeGame:
    def test_concede_returns_200_and_deletes_game(self, client):
        r = client.post("/games/start", json={})
        game_id = r.get_json()["game_id"]
        r = client.post(f"/games/{game_id}/concede")
        assert r.status_code == 200
        assert r.get_json()["status"] == "conceded"
        # Game should be gone
        r = client.get(f"/games/{game_id}")
        assert r.status_code == 404

    def test_concede_nonexistent_returns_404(self, client):
        r = client.post("/games/nonexistent-id/concede")
        assert r.status_code == 404

    def test_concede_records_moon_shots_for_authenticated_user(self, auth_client):
        import os
        from hearts.game_routes import _store, _save_to_db
        from hearts.extensions import db
        from hearts.models import UserStats
        from tests.conftest import make_jwt, auth_headers, JWT_SECRET

        _register_verified(auth_client, "moonplayer", "moon@example.com")
        login_r = auth_client.post("/login", json={
            "username": "moonplayer",
            "password": "password123",
        })
        user = login_r.get_json()["user"]
        token = login_r.get_json()["token"]
        headers = auth_headers(token)

        # Start a game as this user
        r = auth_client.post("/games/start", json={}, headers=headers)
        game_id = r.get_json()["game_id"]

        # Manually set moon shots on the runner
        runner = _store[game_id]
        runner._human_moon_shots = 3
        _save_to_db(game_id, runner, user_id=user["id"])

        # Concede
        r = auth_client.post(f"/games/{game_id}/concede", headers=headers)
        assert r.status_code == 200

        stats = UserStats.query.filter_by(user_id=user["id"]).first()
        assert stats is not None
        assert stats.moon_shots == 3


# -----------------------------------------------------------------------------
# GET /games/active
# -----------------------------------------------------------------------------

class TestActiveGame:
    def test_active_game_returns_game_id(self, auth_client):
        from tests.conftest import make_jwt, auth_headers

        _register_verified(auth_client, "activeplayer", "active@example.com")
        login_r = auth_client.post("/login", json={
            "username": "activeplayer",
            "password": "password123",
        })
        token = login_r.get_json()["token"]
        headers = auth_headers(token)

        r = auth_client.post("/games/start", json={}, headers=headers)
        game_id = r.get_json()["game_id"]

        r = auth_client.get("/games/active", headers=headers)
        assert r.status_code == 200
        assert r.get_json()["game_id"] == game_id

    def test_active_game_none_when_no_game(self, auth_client):
        from tests.conftest import make_jwt, auth_headers

        _register_verified(auth_client, "nogame", "nogame@example.com")
        login_r = auth_client.post("/login", json={
            "username": "nogame",
            "password": "password123",
        })
        token = login_r.get_json()["token"]
        headers = auth_headers(token)

        r = auth_client.get("/games/active", headers=headers)
        assert r.status_code == 200
        assert r.get_json()["game_id"] is None

    def test_active_game_401_without_jwt(self, client):
        r = client.get("/games/active")
        assert r.status_code == 401
