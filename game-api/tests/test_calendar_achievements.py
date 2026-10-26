"""Calendar badges follow each player's local game start, including multiplayer."""

from dataclasses import replace
from datetime import datetime, timedelta

import pytest

from hearts_server import multiplayer_socket as mp
from hearts_server import game_routes
from hearts_server.extensions import db
from hearts_server.models import ActiveGame, UserStats
from hearts_server.multiplayer_runner import MultiplayerRunner
from tests.conftest import add_profile, auth_headers
from tests.test_service import multiplayer, signed
from tests.test_stats_routes import _create_user_and_token


@pytest.mark.parametrize("offset", [420, -330, 0, -840, 720])
@pytest.mark.parametrize(
    "hour, minute, expected",
    [
        (0, 0, "night_owl"),
        (4, 59, "night_owl"),
        (5, 0, "early_bird"),
        (7, 59, "early_bird"),
        (8, 0, None),
        (23, 59, None),
    ],
)
def test_solo_uses_local_start_hour(auth_client, offset, hour, minute, expected):
    _, token = _create_user_and_token(auth_client)
    headers = auth_headers(token)
    game_id = auth_client.post("/games/start", json={}, headers=headers).json["game_id"]
    row = ActiveGame.query.filter_by(game_id=game_id).one()
    row.created_at = datetime(2026, 6, 10, hour, minute) + timedelta(minutes=offset)
    db.session.commit()
    payload = auth_client.post(
        "/stats/record",
        headers=headers,
        json={
            "game_id": game_id,
            "final_score": 25,
            "utc_offset_minutes": offset,
        },
    ).json
    for badge in ("night_owl", "early_bird"):
        assert payload["stats"][badge] == (badge == expected)
        assert (badge in payload["newly_unlocked"]) == (badge == expected)


@pytest.mark.parametrize(
    "utc_start, offsets, expected",
    [
        (datetime(2026, 6, 10, 10, 30), (420, 180), ("night_owl", "early_bird")),
        (datetime(2026, 6, 10, 3, 30), (420, -330), (None, None)),
        (datetime(2026, 11, 1, 3, 30), (420, -120), ("spooky", "early_bird")),
    ],
)
def test_multiplayer_awards_local_badges_before_start_record_is_deleted(
    app, monkeypatch, utc_start, offsets, expected
):
    signed(app)
    add_profile(app, 43, "Bob")
    runner = multiplayer(app)
    other = runner.seats[1]
    other.name, other.is_human, other.player_token, other.user_id = (
        "Bob",
        True,
        "bob-seat",
        43,
    )
    mp._save_to_db("saved-multi", runner)
    row = ActiveGame.query.filter_by(game_id="saved-multi").one()
    row.created_at = utc_start
    db.session.commit()
    monkeypatch.setattr(
        mp, "_start_idle_timers_for_actionable_seats", lambda *args: None
    )
    io = app.extensions["socketio"]
    sockets = [
        io.test_client(
            app,
            namespace="/multi",
            query_string=(
                f"game_id=saved-multi&player_token={token}&auth_token=legacy-{uid}"
                f"&utc_offset_minutes={offset}"
            ),
        )
        for uid, token, offset in zip((42, 43), ("private-seat", "bob-seat"), offsets)
    ]
    assert all(socket.is_connected("/multi") for socket in sockets)
    # Read durable state rather than relying on the original in-memory seats.
    mp._runners.pop("saved-multi")
    runner = mp._get_runner("saved-multi")
    assert [seat.utc_offset_minutes for seat in runner.seats[:2]] == list(offsets)
    runner._state = replace(runner.state, game_over=True, scores=(10, 30, 50, 100))
    mp._on_game_complete("saved-multi", runner, io)
    assert not ActiveGame.query.filter_by(game_id="saved-multi").first()
    for uid, socket, badge in zip((42, 43), sockets, expected):
        stats = UserStats.query.filter_by(user_id=uid).one()
        unlocked = [
            key
            for event in socket.get_received("/multi")
            if event["name"] == "achievements_unlocked"
            for key in event["args"][0]["newly_unlocked"]
        ]
        for key in ("night_owl", "early_bird", "spooky"):
            assert getattr(stats, key) == (key == badge)
            assert (key in unlocked) == (key == badge)
        assert stats.games_played == 1
        socket.disconnect(namespace="/multi")


@pytest.mark.parametrize("offset", ["bad", "1.5", "-841", "721"])
def test_multiplayer_rejects_invalid_offsets(app, offset):
    signed(app)
    multiplayer(app)
    socket = app.extensions["socketio"].test_client(
        app,
        namespace="/multi",
        query_string=(
            "game_id=saved-multi&player_token=private-seat&auth_token=legacy-42"
            f"&utc_offset_minutes={offset}"
        ),
    )
    assert not socket.is_connected("/multi")


def test_reconnect_preserves_original_offset(app, monkeypatch):
    signed(app)
    runner = multiplayer(app)
    runner.seats[0].utc_offset_minutes = 420
    mp._save_to_db("saved-multi", runner)
    monkeypatch.setattr(
        mp, "_start_idle_timers_for_actionable_seats", lambda *args: None
    )
    socket = app.extensions["socketio"].test_client(
        app,
        namespace="/multi",
        query_string=(
            "game_id=saved-multi&player_token=private-seat&auth_token=legacy-42&utc_offset_minutes=360"
        ),
    )
    assert socket.is_connected("/multi")
    restored = MultiplayerRunner.from_json(
        ActiveGame.query.filter_by(game_id="saved-multi").one().state_json
    )
    assert restored.seats[0].utc_offset_minutes == 420
    mp._delete_game("saved-multi")
    socket.disconnect(namespace="/multi")


def test_unknown_offset_cannot_earn_utc_badges(app):
    signed(app)
    runner = multiplayer(app)
    row = ActiveGame.query.filter_by(game_id="saved-multi").one()
    row.created_at = datetime(2026, 1, 1, 3)
    db.session.commit()
    runner._state = replace(runner.state, game_over=True, scores=(10, 30, 50, 100))
    mp._on_game_complete("saved-multi", runner, app.extensions["socketio"])
    stats = UserStats.query.filter_by(user_id=42).one()
    assert not stats.night_owl and not stats.early_bird and not stats.new_year


@pytest.mark.parametrize(
    "start_offset, finish_offset, hour, expected",
    [
        (420, 360, 4, "night_owl"),
        (360, 420, 5, "early_bird"),
        (420, -330, 4, "night_owl"),
    ],
)
def test_solo_resume_retains_start_offset_across_clock_changes(
    auth_client, start_offset, finish_offset, hour, expected
):
    _, token = _create_user_and_token(auth_client)
    headers = auth_headers(token)
    game_id = auth_client.post(
        "/games/start",
        headers=headers,
        json={
            "utc_offset_minutes": start_offset,
        },
    ).json["game_id"]
    row = ActiveGame.query.filter_by(game_id=game_id).one()
    row.created_at = datetime(2026, 6, 10, hour, 30) + timedelta(minutes=start_offset)
    db.session.commit()
    game_routes.reset_store()
    runner = game_routes._get_runner(game_id)
    assert runner.utc_offset_minutes == start_offset
    game_routes._save_to_db(game_id, runner)
    payload = auth_client.post(
        "/stats/record",
        headers=headers,
        json={
            "game_id": game_id,
            "final_score": 25,
            "utc_offset_minutes": finish_offset,
        },
    ).json
    for badge in ("night_owl", "early_bird"):
        assert payload["stats"][badge] == (badge == expected)
        assert (badge in payload["newly_unlocked"]) == (badge == expected)


@pytest.mark.parametrize("offset", ["bad", 1.5, True, -841, 721])
def test_solo_rejects_invalid_start_offsets(auth_client, offset):
    response = auth_client.post("/games/start", json={"utc_offset_minutes": offset})
    assert response.status_code == 400
