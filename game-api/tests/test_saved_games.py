import json
import pytest
from hearts_server.extensions import db
from hearts_server.models import ActiveGame
from hearts_server.multiplayer_runner import MultiplayerRunner, SeatConfig
from tests.conftest import add_profile, auth_headers
from tests.test_lobby_socket import lobby_sockets
from hearts_server.lobby import create_lobby, get_lobby, join_lobby


def test_all_owned_bot_games_survive_new_creates_and_selected_concessions(app, client):
    add_profile(app, 42, "cards_player")
    headers = auth_headers("legacy-42")
    first = client.post("/games/start", json={}, headers=headers).json["game_id"]
    second = client.post("/games/start", json={}, headers=headers).json["game_id"]
    saved = client.get("/games/saved", headers=headers)
    assert saved.headers["Cache-Control"] == "no-store"
    assert {g["id"] for g in saved.json["games"]} == {first, second}
    assert all("hands" not in g and "state_json" not in g for g in saved.json["games"])
    assert client.get("/games/saved").status_code == 401
    assert client.post(f"/games/{first}/concede", json={}, headers=headers).status_code == 200
    assert [g["id"] for g in client.get("/games/saved", headers=headers).json["games"]] == [second]


def test_multiplayer_list_restores_only_the_owners_active_seat_and_excludes_lobbies(app, client):
    add_profile(app, 42, "cards_player")
    seats = [SeatConfig("You", True, "your-seat", user_id=42), SeatConfig("Other", True, "other-seat", user_id=43), SeatConfig("Bot"), SeatConfig("Bot")]
    runner = MultiplayerRunner.new_game(seats)
    db.session.add(ActiveGame(game_id="saved-multi", state_json=runner.to_json(), is_multiplayer=True, lobby_code="ABC234", difficulty="easy"))
    db.session.commit()
    lobby = create_lobby("You")
    lobby.seats[0].user_id = 42
    games = client.get("/games/saved", headers=auth_headers("legacy-42")).json["games"]
    assert len(games) == 1 and games[0]["player_token"] == "your-seat"
    assert "other-seat" not in json.dumps(games)
    runner.seats[0].conceded = True
    row = ActiveGame.query.filter_by(game_id="saved-multi").one()
    row.state_json = runner.to_json()
    db.session.commit()
    assert client.get("/games/saved", headers=auth_headers("legacy-42")).json["games"] == []


def test_waiting_lobby_closes_after_last_connection_but_reconnect_cancels_cleanup(lobby_sockets, monkeypatch, default_test_app):
    connect, _ = lobby_sockets
    socketio = default_test_app.extensions["socketio"]
    tasks, delays = [], []
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: tasks.append(fn))
    monkeypatch.setattr(socketio, "sleep", delays.append)
    lobby = create_lobby("Host")
    first = connect(lobby, lobby.host_token)
    first.disconnect(namespace="/lobby")
    returning = connect(lobby, lobby.host_token)
    tasks.pop(0)()
    assert get_lobby(lobby.code) is not None
    returning.disconnect(namespace="/lobby")
    tasks.pop(0)()
    assert get_lobby(lobby.code) is None
    assert delays == [120, 120]


def test_guest_catalog_requires_the_exact_guest_membership(app, client):
    first = client.post("/games/start", json={}).json["game_id"]
    second = client.post("/games/start", json={}).json["game_id"]
    runner = MultiplayerRunner.new_game([SeatConfig("Guest", True, "guest-seat"),
        SeatConfig("Account", True, "account-seat", user_id=43), SeatConfig("Bot"), SeatConfig("Bot")])
    db.session.add(ActiveGame(game_id="guest-multi", state_json=runner.to_json(), is_multiplayer=True, difficulty="easy"))
    db.session.commit()
    response = client.post("/games/saved-guest", json={"memberships": [
        {"id": first}, {"id": second}, {"id": "guest-multi", "token": "wrong-token"}]})
    assert {g["id"] for g in response.json["games"]} == {first, second}
    response = client.post("/games/saved-guest", json={"memberships": [
        {"id": "guest-multi", "token": "guest-seat"}, {"id": "guest-multi", "token": "account-seat"}]})
    assert len(response.json["games"]) == 1
    assert response.json["games"][0]["player_token"] == "guest-seat"
    assert "account-seat" not in json.dumps(response.json)


@pytest.mark.parametrize("guest_also_leaves", [False, True])
def test_waiting_member_expires_after_two_minutes_and_host_migrates_without_closing_the_lobby(lobby_sockets, monkeypatch, default_test_app, guest_also_leaves):
    connect, _ = lobby_sockets
    socketio = default_test_app.extensions["socketio"]
    tasks, delays = [], []
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: tasks.append(fn))
    monkeypatch.setattr(socketio, "sleep", delays.append)
    lobby = create_lobby("Host")
    _, guest_token = join_lobby(lobby.code, "Guest")
    host = connect(lobby, lobby.host_token)
    other_tab = connect(lobby, lobby.host_token)
    guest = connect(lobby, guest_token)
    original_host = lobby.host_token
    host.disconnect(namespace="/lobby")
    assert tasks == []
    other_tab.disconnect(namespace="/lobby")
    assert original_host in lobby.player_tokens
    if guest_also_leaves:
        guest.disconnect(namespace="/lobby")
    tasks.pop(0)()
    assert get_lobby(lobby.code).status == "waiting"
    assert original_host not in lobby.player_tokens and lobby.host_token == guest_token
    if not guest_also_leaves:
        guest.disconnect(namespace="/lobby")
    assert get_lobby(lobby.code) is not None
    tasks.pop(0)()
    assert get_lobby(lobby.code) is None
    assert delays == [120, 120]
