"""Cleanup preserves scores and permanent stats receipts across worker restarts."""

import json
import time
from dataclasses import replace
from datetime import datetime

from hearts_server import game_routes, multiplayer_socket as mp
from hearts_server.extensions import db
from hearts_server.models import ActiveGame, GameResult, UserStats
from hearts_server.stats_routes import reset_recorded_games
from hearts_server.storage_cleanup import RETENTION_SECONDS, data_for
from tests.conftest import add_profile, auth_headers
from tests.test_service import cleanup as delete_account, multiplayer, post, signed


def age(game_id, when):
    row = ActiveGame.query.filter_by(game_id=game_id).one()
    data = data_for(row)
    data["_closed_at"] = when
    row.state_json, row.updated_at = json.dumps(data), datetime.utcfromtimestamp(when)
    db.session.commit()


def test_solo_cleanup_keeps_scores_achievements_and_durable_duplicate_guard(
    app, client
):
    add_profile(app, 42, "Player")
    headers = auth_headers("legacy-42")
    game_id = client.post("/games/start", json={}, headers=headers).json["game_id"]
    runner = game_routes._get_runner(game_id)
    runner._state = replace(
        runner.state, game_over=True, scores=(7, 20, 30, 100), winner_index=0
    )
    game_routes._save_to_db(game_id, runner)
    payload = dict(
        game_id=game_id,
        final_score=7,
        all_scores=[7, 20, 30, 100],
        won=True,
        moon_shots=2,
        round_count=4,
    )
    first = client.post("/stats/record", json=payload, headers=headers)
    assert first.status_code == 200
    now = time.time()
    age(game_id, now)
    cleanup = app.extensions["cleanup_storage"]
    assert cleanup(now + RETENTION_SECONDS - 1)["games_compacted"] == 0
    assert cleanup(now + RETENTION_SECONDS)["games_compacted"] == 1
    row = ActiveGame.query.filter_by(game_id=game_id).one()
    data = data_for(row)
    assert data["_storage_pruned"] and data["state"]["scores"] == [7, 20, 30, 100]
    assert "hands" not in data["state"] and "rng_state" not in data
    reset_recorded_games()
    db.session.remove()
    retry = client.post("/stats/record", json=payload, headers=headers)
    assert retry.json["stats"] == first.json["stats"]
    assert retry.json["newly_unlocked"] == []
    assert GameResult.query.count() == 1
    assert client.get("/games/active", headers=headers).json["game_id"] is None
    assert client.get("/games/saved", headers=headers).json["games"] == []
    assert client.get("/games/" + game_id).status_code == 404
    # A late background callback cannot restore the removed cards.
    game_routes._save_to_db(game_id, runner)
    assert data_for(ActiveGame.query.filter_by(game_id=game_id).one())[
        "_storage_pruned"
    ]
    assert cleanup(now + RETENTION_SECONDS)["games_compacted"] == 0


def test_retired_multiplayer_account_links_can_be_deleted_without_a_runner(app):
    client = signed(app)
    runner = multiplayer(app)
    runner._state = replace(runner.state, game_over=True, scores=(10, 30, 50, 100))
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    now = time.time()
    age("saved-multi", now - RETENTION_SECONDS)
    app.extensions["cleanup_storage"](now)
    assert delete_account(client).json["deleted"]
    data = data_for(ActiveGame.query.filter_by(game_id="saved-multi").one())
    assert data["_storage_pruned"] and data["_recorded_users"] == []
    assert all(seat["user_id"] is None for seat in data["seats"])
    assert GameResult.query.count() == 0


def test_legacy_result_retry_creates_a_receipt_that_keeps_the_service_ready(
    app, client
):
    add_profile(app, 42, "Player")
    headers = auth_headers("legacy-42")
    payload = dict(
        game_id="old-finished-game", final_score=20, difficulty="multiplayer"
    )
    assert (
        client.post("/stats/record", json=payload, headers=headers).status_code == 200
    )
    from hearts_server.schema import schema_ready

    assert schema_ready()


def test_conceded_game_stays_closed_and_does_not_become_a_completed_result(app, client):
    add_profile(app, 42, "Player")
    headers = auth_headers("legacy-42")
    game_id = client.post("/games/start", json={}, headers=headers).json["game_id"]
    assert (
        client.post(f"/games/{game_id}/concede", json={}, headers=headers).status_code
        == 200
    )
    now = time.time()
    age(game_id, now - RETENTION_SECONDS)
    app.extensions["cleanup_storage"](now)
    reset_recorded_games()
    assert (
        client.post(
            "/stats/record",
            json=dict(game_id=game_id, final_score=0, won=True),
            headers=headers,
        ).status_code
        == 409
    )
    assert GameResult.query.count() == 0


def test_old_unfinished_game_survives_and_pending_final_result_can_still_save(
    app, client
):
    add_profile(app, 42, "Player")
    headers = auth_headers("legacy-42")
    live = client.post("/games/start", json={}, headers=headers).json["game_id"]
    pending = client.post("/games/start", json={}, headers=headers).json["game_id"]
    runner = game_routes._get_runner(pending)
    runner._state = replace(
        runner.state, game_over=True, scores=(20, 30, 40, 100), winner_index=0
    )
    game_routes._save_to_db(pending, runner)
    now = time.time()
    for game_id in (live, pending):
        row = ActiveGame.query.filter_by(game_id=game_id).one()
        row.updated_at = datetime.utcfromtimestamp(now - RETENTION_SECONDS - 1)
    db.session.commit()
    assert app.extensions["cleanup_storage"](now)["games_compacted"] == 1
    assert not data_for(ActiveGame.query.filter_by(game_id=live).one()).get("_closed")
    assert client.get("/games/active", headers=headers).json["game_id"] == live
    assert (
        client.post(
            "/stats/record",
            json=dict(game_id=pending, final_score=20, won=True),
            headers=headers,
        ).status_code
        == 200
    )
    assert UserStats.query.filter_by(user_id=42).one().games_played == 1


def test_multiplayer_completion_receipt_prevents_recount_after_cleanup(app):
    client = signed(app)
    runner = multiplayer(app)
    runner.seats[0].utc_offset_minutes = 0
    ActiveGame.query.filter_by(game_id="saved-multi").one().created_at = datetime(
        2026, 6, 10, 10, 30
    )
    db.session.commit()
    runner._state = replace(
        runner.state, game_over=True, scores=(10, 30, 50, 100), winner_index=0
    )
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    now = time.time()
    age("saved-multi", now - RETENTION_SECONDS)
    app.extensions["cleanup_storage"](now)
    assert data_for(ActiveGame.query.filter_by(game_id="saved-multi").one())[
        "_recorded_users"
    ] == [42]
    reset_recorded_games()
    before = UserStats.query.filter_by(user_id=42).one().to_dict()
    assert (
        post(
            client,
            "/stats/record",
            dict(
                game_id="saved-multi", final_score=10, won=True, utc_offset_minutes=420
            ),
        ).json["stats"]["games_played"]
        == 1
    )
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert GameResult.query.count() == 1
    assert UserStats.query.filter_by(user_id=42).one().to_dict() == before


def test_http_result_retry_before_socket_completion_does_not_skip_other_players(app):
    client = signed(app)
    add_profile(app, 43, "Other player")
    runner = multiplayer(app)
    runner.seats[1].is_human = True
    runner.seats[1].user_id = 43
    mp._game_auth["saved-multi"][1] = 43
    runner._state = replace(runner.state, game_over=True, scores=(10, 30, 50, 100))
    mp._save_to_db("saved-multi", runner)
    assert (
        post(
            client,
            "/stats/record",
            dict(game_id="saved-multi", final_score=10, won=True),
        ).status_code
        == 200
    )
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert {row.user_id: row.games_played for row in UserStats.query.all()} == {
        42: 1,
        43: 1,
    }
    assert GameResult.query.count() == 2
    assert data_for(ActiveGame.query.filter_by(game_id="saved-multi").one())[
        "_recorded_users"
    ] == [42, 43]
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    assert GameResult.query.count() == 2
