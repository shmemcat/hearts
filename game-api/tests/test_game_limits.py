from hearts_server.extensions import db
from hearts_server.game_limits import open_games
from hearts_server.models import ActiveGame
from hearts_server.multiplayer_runner import MultiplayerRunner, SeatConfig
from tests.conftest import add_profile, auth_headers


def test_combined_cap_blocks_new_games_but_allows_resume_and_concede(app, client):
    app.config["MAX_IN_PROGRESS_GAMES"] = 2
    add_profile(app, 42, "Player")
    headers = auth_headers("legacy-42")
    first = client.post("/games/start", json={}, headers=headers).json["game_id"]
    runner = MultiplayerRunner.new_game(
        [
            SeatConfig("Player", True, "seat", user_id=42),
            SeatConfig("Friend", True, "other"),
            SeatConfig("Bot"),
            SeatConfig("Bot"),
        ]
    )
    db.session.add(
        ActiveGame(
            game_id="multi-limit",
            is_multiplayer=True,
            state_json=runner.to_json(),
            difficulty="easy",
        )
    )
    db.session.commit()
    blocked = client.post("/games/start", json={}, headers=headers)
    assert blocked.status_code == 409 and "2 games in progress" in blocked.json["error"]
    assert client.post("/lobbies/create", json={}, headers=headers).status_code == 409
    assert client.get("/games/" + first).status_code == 200
    assert (
        client.post(f"/games/{first}/concede", json={}, headers=headers).status_code
        == 200
    )
    assert open_games("account:42") == 1
    assert client.post("/games/start", json={}, headers=headers).status_code == 201


def test_guest_bot_games_share_the_browser_allowance(app, client):
    app.config["MAX_IN_PROGRESS_GAMES"] = 2
    assert client.post("/games/start", json={}).status_code == 201
    assert client.post("/games/start", json={}).status_code == 201
    assert client.post("/games/start", json={}).status_code == 409


def test_creation_window_expires_and_is_separate_per_player(app):
    import pytest
    from hearts_server.game_limits import GameLimit, check_creation

    with app.app_context():
        for _ in range(5):
            check_creation("account:rate-test")
        with pytest.raises(GameLimit) as error:
            check_creation("account:rate-test")
        assert error.value.status == 429
        check_creation("account:another-player")
        app.extensions["game_creation_times"]["account:rate-test"] = [-1000]
        check_creation("account:rate-test")
