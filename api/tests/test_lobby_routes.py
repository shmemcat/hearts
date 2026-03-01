"""Tests for lobby REST endpoints."""

from datetime import datetime, timedelta

import pytest
from hearts.lobby import reset_store
from hearts.multiplayer_socket import _runners


@pytest.fixture(autouse=True)
def clean_lobby_store():
    reset_store()
    _runners.clear()
    yield
    reset_store()
    _runners.clear()


class TestCreateEndpoint:
    def test_returns_201_with_code_url_token(self, client):
        resp = client.post("/lobbies/create", json={"host_name": "Alice"})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "code" in data
        assert len(data["code"]) == 6
        assert "url" in data
        assert data["code"] in data["url"]
        assert "player_token" in data

    def test_missing_host_name_uses_default(self, client):
        resp = client.post("/lobbies/create", json={})
        assert resp.status_code == 201
        data = resp.get_json()
        assert "code" in data


class TestGetLobbyEndpoint:
    def test_returns_lobby_dict(self, client):
        create = client.post("/lobbies/create", json={"host_name": "Alice"})
        code = create.get_json()["code"]
        resp = client.get(f"/lobbies/{code}")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["code"] == code
        assert len(data["seats"]) == 4

    def test_invalid_code_returns_404(self, client):
        resp = client.get("/lobbies/ZZZZZZ")
        assert resp.status_code == 404


class TestCheckGameActive:
    def test_returns_false_for_missing_game(self, client):
        resp = client.get("/lobbies/game/nonexistent123/active")
        assert resp.status_code == 200
        assert resp.get_json()["active"] is False

    def test_returns_true_for_existing_game(self, client):
        from hearts.extensions import db
        from hearts.models import ActiveGame

        game = ActiveGame(
            game_id="test123",
            is_multiplayer=True,
            state_json="{}",
            updated_at=datetime.utcnow(),
        )
        db.session.add(game)
        db.session.commit()

        resp = client.get("/lobbies/game/test123/active")
        assert resp.status_code == 200
        assert resp.get_json()["active"] is True

    def test_returns_false_for_stale_game(self, client):
        from hearts.extensions import db
        from hearts.models import ActiveGame

        stale_time = datetime.utcnow() - timedelta(minutes=45)
        game = ActiveGame(
            game_id="stale1",
            is_multiplayer=True,
            state_json="{}",
            created_at=stale_time,
            updated_at=stale_time,
        )
        db.session.add(game)
        db.session.commit()

        resp = client.get("/lobbies/game/stale1/active")
        assert resp.status_code == 200
        assert resp.get_json()["active"] is False

        row = ActiveGame.query.filter_by(game_id="stale1").first()
        assert row is None


class TestConcedeMultiplayer:
    def _create_game(self, client):
        from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig
        from hearts.multiplayer_socket import _runners
        from hearts.extensions import db
        from hearts.models import ActiveGame

        seats = [
            SeatConfig(name="Alice", is_human=True, player_token="tok_alice"),
            SeatConfig(name="Bot 1", is_human=False),
            SeatConfig(name="Bob", is_human=True, player_token="tok_bob"),
            SeatConfig(name="Bot 2", is_human=False),
        ]
        runner = MultiplayerRunner.new_game(seats, difficulty="easy")
        _runners["game-abc"] = runner

        row = ActiveGame(
            game_id="game-abc",
            is_multiplayer=True,
            state_json=runner.to_json(),
            updated_at=datetime.utcnow(),
        )
        db.session.add(row)
        db.session.commit()
        return runner

    def test_concede_returns_conceded(self, client):
        self._create_game(client)
        resp = client.post(
            "/lobbies/game/game-abc/concede",
            json={"player_token": "tok_alice"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "conceded"

    def test_concede_last_human_returns_terminated(self, client):
        runner = self._create_game(client)
        runner.concede_player(0)  # concede Alice first
        resp = client.post(
            "/lobbies/game/game-abc/concede",
            json={"player_token": "tok_bob"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["status"] == "terminated"

    def test_missing_token_returns_400(self, client):
        self._create_game(client)
        resp = client.post("/lobbies/game/game-abc/concede", json={})
        assert resp.status_code == 400

    def test_invalid_game_returns_404(self, client):
        resp = client.post(
            "/lobbies/game/nonexistent/concede",
            json={"player_token": "tok"},
        )
        assert resp.status_code == 404

    def test_invalid_token_returns_404(self, client):
        self._create_game(client)
        resp = client.post(
            "/lobbies/game/game-abc/concede",
            json={"player_token": "bad_token"},
        )
        assert resp.status_code == 404
