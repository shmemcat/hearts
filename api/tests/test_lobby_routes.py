"""Tests for lobby REST endpoints."""

import pytest
from hearts.lobby import reset_store


@pytest.fixture(autouse=True)
def clean_lobby_store():
    reset_store()
    yield
    reset_store()


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

        game = ActiveGame(game_id="test123", is_multiplayer=True, state_json="{}")
        db.session.add(game)
        db.session.commit()

        resp = client.get("/lobbies/game/test123/active")
        assert resp.status_code == 200
        assert resp.get_json()["active"] is True
