"""
Tests for stats routes: GET /stats, POST /stats/record.
"""

import os
import pytest
from unittest.mock import patch

from tests.conftest import JWT_SECRET, make_jwt, auth_headers


@pytest.fixture(autouse=True)
def _reset_dedup():
    """Clear the in-memory dedup set between tests."""
    from hearts.stats_routes import reset_recorded_games
    reset_recorded_games()
    yield
    reset_recorded_games()


def _create_user_and_token(auth_client):
    """Register a user and return (user_id, jwt_token)."""
    with patch("hearts.auth_routes.send_verification_email"):
        r = auth_client.post("/register", json={
            "username": "statsuser",
            "email": "stats@example.com",
            "password": "password123",
        })
    user = r.get_json()["user"]
    token = make_jwt(user["id"], username=user["username"], email=user["email"])
    return user["id"], token


# -----------------------------------------------------------------------------
# GET /stats
# -----------------------------------------------------------------------------

class TestGetStats:
    def test_returns_defaults_for_new_user(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        r = auth_client.get("/stats", headers=auth_headers(token))
        assert r.status_code == 200
        stats = r.get_json()["stats"]
        assert stats["games_played"] == 0
        assert stats["games_won"] == 0
        assert stats["moon_shots"] == 0
        assert stats["best_score"] is None
        assert stats["worst_score"] is None
        assert stats["average_score"] is None

    def test_401_without_jwt(self, auth_client):
        r = auth_client.get("/stats")
        assert r.status_code == 401


# -----------------------------------------------------------------------------
# POST /stats/record
# -----------------------------------------------------------------------------

class TestRecordGame:
    def test_record_updates_stats(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        headers = auth_headers(token)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-1",
            "final_score": 45,
            "won": True,
            "moon_shots": 1,
        }, headers=headers)
        assert r.status_code == 200
        stats = r.get_json()["stats"]
        assert stats["games_played"] == 1
        assert stats["games_won"] == 1
        assert stats["moon_shots"] == 1
        assert stats["best_score"] == 45
        assert stats["worst_score"] == 45
        assert stats["average_score"] == 45.0

    def test_record_multiple_games(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        headers = auth_headers(token)
        auth_client.post("/stats/record", json={
            "game_id": "game-1",
            "final_score": 40,
            "won": True,
        }, headers=headers)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-2",
            "final_score": 60,
            "won": False,
        }, headers=headers)
        assert r.status_code == 200
        stats = r.get_json()["stats"]
        assert stats["games_played"] == 2
        assert stats["games_won"] == 1
        assert stats["best_score"] == 40
        assert stats["worst_score"] == 60
        assert stats["average_score"] == 50.0

    def test_deduplication(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        headers = auth_headers(token)
        auth_client.post("/stats/record", json={
            "game_id": "game-dup",
            "final_score": 30,
            "won": True,
        }, headers=headers)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-dup",
            "final_score": 30,
            "won": True,
        }, headers=headers)
        assert r.status_code == 200
        stats = r.get_json()["stats"]
        assert stats["games_played"] == 1

    def test_missing_game_id_returns_400(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        r = auth_client.post("/stats/record", json={
            "final_score": 30,
        }, headers=auth_headers(token))
        assert r.status_code == 400

    def test_missing_final_score_returns_400(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-x",
        }, headers=auth_headers(token))
        assert r.status_code == 400

    def test_401_without_jwt(self, auth_client):
        r = auth_client.post("/stats/record", json={
            "game_id": "game-x",
            "final_score": 30,
        })
        assert r.status_code == 401

    def test_moon_shots_accumulate(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        headers = auth_headers(token)
        auth_client.post("/stats/record", json={
            "game_id": "game-1",
            "final_score": 20,
            "moon_shots": 2,
        }, headers=headers)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-2",
            "final_score": 10,
            "moon_shots": 1,
        }, headers=headers)
        stats = r.get_json()["stats"]
        assert stats["moon_shots"] == 3

    def test_average_score_calculation(self, auth_client):
        _, token = _create_user_and_token(auth_client)
        headers = auth_headers(token)
        auth_client.post("/stats/record", json={
            "game_id": "game-1",
            "final_score": 10,
        }, headers=headers)
        auth_client.post("/stats/record", json={
            "game_id": "game-2",
            "final_score": 20,
        }, headers=headers)
        r = auth_client.post("/stats/record", json={
            "game_id": "game-3",
            "final_score": 30,
        }, headers=headers)
        stats = r.get_json()["stats"]
        assert stats["average_score"] == 20.0
