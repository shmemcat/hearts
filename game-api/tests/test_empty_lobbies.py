"""Empty groups close across the lobby, game, and results socket lifecycles."""

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
    monkeypatch.setattr(
        mp, "_start_idle_timers_for_actionable_seats", lambda *args: None
    )
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
        timers[-1].callback()
    assert lobby.status == "finished"
    assert received(observer, "lobby_closed") == [{}]
    with pytest.raises(ValueError):
        join_lobby(lobby.code, "Late arrival")


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
def test_abandoned_game_does_not_reopen_an_empty_lobby(app, game, departure):
    lobby, game_id, runner, sockets, tokens = game
    for index, token in enumerate(tokens):
        if departure == "leave":
            result = mp.concede_multiplayer_by_token(
                game_id, token, app.extensions["socketio"], app
            )
            assert result == ("terminated" if index == 1 else "conceded")
        else:
            sockets[index].disconnect(namespace="/multi")
            timer = mp._disconnect_timers[token]
            assert not runner.seats[index].conceded
            timer.callback()
    assert lobby.status == "finished"
    assert not lobby.player_tokens
    assert not lobby._disconnect_timers
    assert ActiveGame.query.filter_by(game_id=game_id).first() is None
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
            timer = lobby._disconnect_timers[tokens[index]]
            assert lobby.status == "waiting"
            timer.callback()
    assert lobby.status == "finished"
    assert GameResult.query.count() == 1
    assert GameResult.query.one().won


def test_results_to_lobby_reconnect_and_stale_timer_are_safe(app, game, lobby_sockets):
    finish(app, game)
    lobby, _, _, sockets, tokens = game
    connect, _ = lobby_sockets
    sockets[0].disconnect(namespace="/multi")
    old_timer = lobby._disconnect_timers[tokens[0]]
    returning = connect(lobby, tokens[0])
    old_timer.callback()
    assert old_timer.cancelled
    assert tokens[0] in lobby.player_tokens
    # The results connection remains alive while the temporary lobby socket leaves.
    second_tab = connect(lobby, tokens[1])
    second_tab.disconnect(namespace="/lobby")
    assert tokens[1] not in lobby._disconnect_timers
    returning.emit("leave", namespace="/lobby")
    assert lobby.status == "waiting"
    sockets[1].disconnect(namespace="/multi")
    lobby._disconnect_timers[tokens[1]].callback()
    assert get_lobby(lobby.code).status == "finished"
    assert GameResult.query.one().won


def test_lobby_created_without_connecting_also_expires(app, lobby_sockets):
    _, timers = lobby_sockets
    response = app.test_client().post("/lobbies/create", json={"host_name": "Host"})
    assert response.status_code == 201
    lobby = get_lobby(response.json["code"])
    assert lobby.status == "waiting"
    timers[-1].callback()
    assert lobby.status == "finished"
