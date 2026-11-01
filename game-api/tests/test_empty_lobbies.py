"""Empty groups close across the lobby, game, and results socket lifecycles."""
import json

from dataclasses import replace

import pytest

from hearts_server import multiplayer_socket as mp
from hearts_server.lobby import create_lobby, get_lobby, join_lobby, start_game
from hearts_server.models import ActiveGame, GameResult
from tests.conftest import add_profile
from tests.test_lobby_socket import lobby_sockets, received


@pytest.fixture
def game(app, lobby_sockets, monkeypatch):
    monkeypatch.setattr(mp, "advance_if_bot_turn", lambda *args: None)
    lobby = create_lobby("Host", num_ai=3)
    _, guest_token = join_lobby(lobby.code, "Guest")
    tokens = [lobby.host_token, guest_token]
    game_id = start_game(lobby.code, "easy")
    socketio = app.extensions["socketio"]
    runner = mp.create_multiplayer_game(
        game_id,
        lobby.code,
        "easy",
        [
            dict(name=s.name, is_ai=s.is_ai, player_token=s.player_token)
            for s in lobby.seats
        ],
        socketio,
    )
    sockets = [
        socketio.test_client(
            app,
            namespace="/multi",
            query_string=f"game_id={game_id}&player_token={token}",
        )
        for token in tokens
    ]
    yield lobby, game_id, runner, sockets, tokens
    for socket in sockets:
        if socket.is_connected("/multi"):
            socket.disconnect(namespace="/multi")


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
def test_bots_do_not_keep_a_waiting_lobby_open(lobby_sockets, departure):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host", num_ai=3)
    host = connect(lobby, lobby.host_token)
    observer = connect(lobby)
    if departure == "leave":
        host.emit("leave", namespace="/lobby")
    else:
        host.disconnect(namespace="/lobby")
        assert lobby.status == "waiting"
        assert not timers
        host = connect(lobby, lobby.host_token)
        host.emit("leave", namespace="/lobby")
    assert lobby.status == "finished"
    assert received(observer, "lobby_closed") == [{}]
    with pytest.raises(ValueError):
        join_lobby(lobby.code, "Late arrival")


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
def test_abandoned_game_does_not_reopen_an_empty_lobby(app, game, departure):
    lobby, game_id, runner, sockets, tokens = game
    add_profile(app, 42, "Remaining player")
    runner.seats[1].user_id = 42
    mp._game_auth[game_id][1] = 42
    if departure == "leave":
        result = sockets[0].emit("concede", namespace="/multi", callback=True)["status"]
    else:
        sockets[0].disconnect(namespace="/multi")
        assert not runner.seats[0].conceded
        result = mp.concede_multiplayer_by_token(game_id, tokens[0], app.extensions["socketio"], app)
    assert result == "terminated"
    assert not runner.seats[1].conceded and get_lobby(lobby.code) is None
    assert not lobby._disconnect_timers
    assert json.loads(ActiveGame.query.filter_by(game_id=game_id).one().state_json)["_closed"] == "cancelled"
    assert GameResult.query.count() == 0
    with pytest.raises(ValueError):
        join_lobby(lobby.code, "Late arrival")


def finish(app, game):
    lobby, game_id, runner, sockets, tokens = game
    add_profile(app, 42, "Host")
    runner.seats[0].user_id = 42
    mp._game_auth[game_id][0] = 42
    runner._state = replace(
        runner.state, game_over=True, scores=(0, 20, 40, 100), winner_index=0
    )
    mp._on_game_complete(game_id, runner, app.extensions["socketio"])
    assert lobby.status == "waiting"
    assert not lobby._disconnect_timers
    assert GameResult.query.one().won


def test_saved_game_already_reduced_to_one_human_closes_on_resume(app, game):
    from hearts_server.extensions import db
    lobby, game_id, runner, sockets, tokens = game
    data = runner.to_dict()
    data["seats"][0]["conceded"] = True
    row = ActiveGame.query.filter_by(game_id=game_id).one()
    import json
    row.state_json = json.dumps(data)
    db.session.commit()
    mp._runners.pop(game_id, None)
    sockets[1].get_received("/multi")
    sockets[1].emit("request_state", namespace="/multi")
    assert any(event["name"] == "game_terminated" for event in sockets[1].get_received("/multi"))
    assert json.loads(ActiveGame.query.filter_by(game_id=game_id).one().state_json)["_closed"] == "cancelled"
    assert get_lobby(lobby.code) is None and GameResult.query.count() == 0


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
def test_results_departures_close_the_group_and_preserve_saved_results(
    app, game, lobby_sockets, departure
):
    finish(app, game)
    lobby, _, _, sockets, tokens = game
    connect, _ = lobby_sockets
    for index, socket in enumerate(sockets):
        if departure == "leave":
            returning = connect(lobby, tokens[index])
            returning.emit("leave", namespace="/lobby")
        else:
            socket.disconnect(namespace="/multi")
            assert not lobby._disconnect_timers
            assert lobby.status == "waiting"
            returning = connect(lobby, tokens[index])
            returning.emit("leave", namespace="/lobby")
    assert lobby.status == "finished"
    assert GameResult.query.count() == 1
    assert GameResult.query.one().won


def test_results_to_lobby_reconnect_and_stale_timer_are_safe(app, game, lobby_sockets):
    finish(app, game)
    lobby, _, _, sockets, tokens = game
    connect, _ = lobby_sockets
    sockets[0].disconnect(namespace="/multi")
    assert not lobby._disconnect_timers
    returning = connect(lobby, tokens[0])
    assert tokens[0] in lobby.player_tokens
    # The results connection remains alive while the temporary lobby socket leaves.
    second_tab = connect(lobby, tokens[1])
    second_tab.disconnect(namespace="/lobby")
    assert tokens[1] not in lobby._disconnect_timers
    returning.emit("leave", namespace="/lobby")
    assert lobby.status == "waiting"
    sockets[1].disconnect(namespace="/multi")
    assert get_lobby(lobby.code).status == "waiting"
    returning = connect(lobby, tokens[1])
    returning.emit("leave", namespace="/lobby")
    assert get_lobby(lobby.code).status == "finished"
    assert GameResult.query.one().won


def test_connected_results_tabs_and_temporary_lobby_tabs_do_not_start_removal(app, game, lobby_sockets, monkeypatch):
    socketio = app.extensions["socketio"]
    pending = []
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: pending.append(fn))
    finish(app, game)
    lobby, _, _, sockets, tokens = game
    assert all(socket.is_connected("/multi") for socket in sockets)
    assert pending == []
    connect, _ = lobby_sockets
    temporary = connect(lobby, tokens[1])
    temporary.disconnect(namespace="/lobby")
    assert pending == [] and set(lobby.player_tokens) == set(tokens)
    assert get_lobby(lobby.code) is lobby


@pytest.mark.parametrize("reconnect", [False, True])
def test_results_departures_only_expire_absent_members_and_keep_completed_results(app, game, lobby_sockets, monkeypatch, reconnect):
    socketio = app.extensions["socketio"]
    pending, delays = [], []
    monkeypatch.setattr(socketio, "start_background_task", lambda fn: pending.append(fn))
    monkeypatch.setattr(socketio, "sleep", delays.append)
    finish(app, game)
    lobby, _, _, sockets, tokens = game
    assert pending == []
    sockets[0].disconnect(namespace="/multi")
    assert len(pending) == 1
    if reconnect:
        connect, _ = lobby_sockets
        returning = connect(lobby, tokens[0])
        assert returning.is_connected("/lobby")
    pending.pop(0)()
    assert get_lobby(lobby.code) is lobby and sockets[1].is_connected("/multi")
    assert tokens[1] in lobby.player_tokens
    if reconnect:
        assert tokens[0] in lobby.player_tokens
    else:
        assert tokens[0] not in lobby.player_tokens and lobby.host_token == tokens[1]
        sockets[1].disconnect(namespace="/multi")
        assert get_lobby(lobby.code) is lobby
        pending.pop(0)()
        assert get_lobby(lobby.code) is None
    assert delays == ([120] if reconnect else [120,120])
    assert GameResult.query.count() == 1 and GameResult.query.one().won


def test_lobby_created_without_connecting_preserves_its_host(app, lobby_sockets):
    _, timers = lobby_sockets
    response = app.test_client().post("/lobbies/create", json={"host_name": "Host"})
    assert response.status_code == 201
    lobby = get_lobby(response.json["code"])
    assert lobby.status == "waiting"
    assert not timers
    lobby.last_activity -= 30 * 86400
    assert get_lobby(lobby.code) is lobby
    assert lobby.status == "waiting"
