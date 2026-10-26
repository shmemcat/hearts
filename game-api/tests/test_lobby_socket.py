"""Lobby reconnects must restore ownership and safely retire old connections."""

from urllib.parse import urlencode

import pytest

from hearts_server.lobby import create_lobby, get_lobby, join_lobby, reset_store


class DisconnectTimer:
    def __init__(self, callback):
        self.callback = callback
        self.cancelled = False

    def cancel(self):
        self.cancelled = True


@pytest.fixture
def lobby_sockets(monkeypatch, default_test_app):
    from hearts_server import lobby_socket

    app = default_test_app
    socketio = app.extensions["socketio"]
    clients = []
    timers = []
    monkeypatch.setitem(app.config, "TESTING", True)

    def spawn_after(seconds, callback):
        timer = DisconnectTimer(callback)
        timers.append(timer)
        return timer

    monkeypatch.setattr("eventlet.spawn_after", spawn_after)

    def connect(lobby, token=None, *, use_auth=False, query=None):
        identity = {"lobby_code": lobby.code}
        if token:
            identity["player_token"] = token
        client = socketio.test_client(
            app,
            namespace="/lobby",
            query_string=urlencode(query or ({} if use_auth else identity)),
            auth=identity if use_auth else None,
        )
        clients.append(client)
        return client

    # Direct lobby helpers must use the same application as socket requests.
    with app.app_context():
        reset_store()
        lobby_socket._sid_to_lobby.clear()
        yield connect, timers

        for client in clients:
            if client.is_connected("/lobby"):
                client.disconnect(namespace="/lobby")
        reset_store()
        lobby_socket._sid_to_lobby.clear()


def received(client, name):
    return [
        event["args"][0]
        for event in client.get_received("/lobby")
        if event["name"] == name
    ]


@pytest.mark.parametrize("use_auth", [False, True])
def test_returning_host_is_confirmed_and_can_close(lobby_sockets, use_auth):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    first = connect(lobby, lobby.host_token, use_auth=use_auth)
    first.disconnect(namespace="/lobby")
    assert not timers

    returning = connect(lobby, lobby.host_token, use_auth=use_auth)
    assert received(returning, "lobby_session") == [
        {"player_token": lobby.host_token, "seat_index": 0}
    ]
    returning.emit("close_lobby", namespace="/lobby")
    assert received(returning, "lobby_closed") == [{}]
    assert get_lobby(lobby.code) is None


def test_namespace_auth_overrides_stale_transport_query(lobby_sockets):
    connect, _ = lobby_sockets
    old_lobby = create_lobby("Previous host")
    lobby = create_lobby("Returning host")
    returning = connect(
        lobby,
        lobby.host_token,
        use_auth=True,
        query={"lobby_code": old_lobby.code, "player_token": old_lobby.host_token},
    )
    assert received(returning, "lobby_session") == [
        {"player_token": lobby.host_token, "seat_index": 0}
    ]
    returning.emit("close_lobby", namespace="/lobby")
    assert received(returning, "lobby_closed") == [{}]
    assert get_lobby(lobby.code) is None
    assert get_lobby(old_lobby.code) is old_lobby


def test_returning_guest_is_confirmed_but_cannot_close(lobby_sockets):
    connect, _ = lobby_sockets
    lobby = create_lobby("Host")
    seat, token = join_lobby(lobby.code, "Guest")
    guest = connect(lobby, token)
    assert received(guest, "lobby_session") == [
        {"player_token": token, "seat_index": seat}
    ]
    guest.emit("close_lobby", namespace="/lobby")
    assert received(guest, "error") == [
        {"message": "Only the host can close the lobby"}
    ]
    assert get_lobby(lobby.code) is lobby


def test_invalid_saved_token_is_confirmed_as_visitor(lobby_sockets):
    connect, _ = lobby_sockets
    lobby = create_lobby("Host")
    visitor = connect(lobby, "expired-token")
    assert received(visitor, "lobby_session") == [
        {"player_token": None, "seat_index": None}
    ]
    visitor.emit("close_lobby", namespace="/lobby")
    assert received(visitor, "error") == [{"message": "You are not in this lobby"}]
    assert get_lobby(lobby.code) is lobby


def test_disconnected_host_stays_in_lobby_for_an_unlimited_wait(lobby_sockets):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    _, guest_token = join_lobby(lobby.code, "Guest")
    host = connect(lobby, lobby.host_token)
    guest = connect(lobby, guest_token)
    host.disconnect(namespace="/lobby")
    lobby.last_activity -= 30 * 86400
    assert get_lobby(lobby.code) is lobby
    assert lobby.seats[0] is not None and not timers
    returning = connect(lobby, lobby.host_token)
    returning.emit("leave", namespace="/lobby")
    assert lobby.host_token == guest_token
    guest.emit("close_lobby", namespace="/lobby")
    assert received(guest, "lobby_closed") == [{}]


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
def test_next_arrival_receives_host_controls_after_departure(lobby_sockets, departure):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    _, first_token = join_lobby(lobby.code, "First", seat_preference=3)
    _, later_token = join_lobby(lobby.code, "Later", seat_preference=1)
    host = connect(lobby, lobby.host_token)
    first = connect(lobby, first_token)
    later = connect(lobby, later_token)
    first.get_received("/lobby")
    later.get_received("/lobby")

    if departure == "leave":
        host.emit("leave", namespace="/lobby")
    else:
        host.disconnect(namespace="/lobby")
        assert lobby.host_token != first_token
        host = connect(lobby, lobby.host_token)
        host.emit("leave", namespace="/lobby")

    assert received(first, "lobby_update")[-1]["host_token"] == first_token
    assert received(later, "lobby_update")[-1]["host_token"] == first_token
    later.emit("close_lobby", namespace="/lobby")
    assert received(later, "error") == [
        {"message": "Only the host can close the lobby"}
    ]
    first.emit("close_lobby", namespace="/lobby")
    assert received(first, "lobby_closed") == [{}]


def test_disconnection_does_not_remove_reconnected_host(lobby_sockets):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    host = connect(lobby, lobby.host_token)
    host.disconnect(namespace="/lobby")
    returning = connect(lobby, lobby.host_token)

    # Even if a cancelled task wakes up, it belongs to the previous connection.

    assert lobby.seats[0] is not None
    assert lobby.host_token in lobby.player_tokens
    returning.emit("close_lobby", namespace="/lobby")
    assert received(returning, "lobby_closed") == [{}]


def test_superseded_connection_does_not_start_disconnect_timer(lobby_sockets):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    old = connect(lobby, lobby.host_token)
    current = connect(lobby, lobby.host_token)

    old.disconnect(namespace="/lobby")

    assert not timers
    current.emit("close_lobby", namespace="/lobby")
    assert received(current, "lobby_closed") == [{}]


def test_last_host_can_lock_their_phone_and_return_to_the_same_lobby(lobby_sockets):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    host = connect(lobby, lobby.host_token)
    host.disconnect(namespace="/lobby")
    assert not timers
    returning = connect(lobby, lobby.host_token)
    assert received(returning, "lobby_session") == [
        dict(player_token=lobby.host_token, seat_index=0)
    ]
    assert lobby.status == "waiting"


def test_offline_guest_becomes_host_until_their_own_explicit_departure(lobby_sockets):
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    _, guest_token = join_lobby(lobby.code, "Guest")
    host = connect(lobby, lobby.host_token)
    guest = connect(lobby, guest_token)
    observer = connect(lobby)
    guest.disconnect(namespace="/lobby")
    host.emit("leave", namespace="/lobby")
    assert lobby.host_token == guest_token and lobby.status == "waiting"
    assert not timers
    guest = connect(lobby, guest_token)
    guest.emit("leave", namespace="/lobby")
    assert lobby.status == "finished"
    assert received(observer, "lobby_closed") == [{}]


def test_returning_host_can_start_with_the_same_saved_membership(
    lobby_sockets, monkeypatch
):
    from hearts_server import lobby_socket

    games = []
    monkeypatch.setattr(
        lobby_socket, "create_multiplayer_game", lambda *args: games.append(args)
    )
    connect, timers = lobby_sockets
    lobby = create_lobby("Host")
    host = connect(lobby, lobby.host_token)
    host.disconnect(namespace="/lobby")
    returning = connect(lobby, lobby.host_token)

    returning.emit("start_game", {"difficulty": "easy"}, namespace="/lobby")

    assert lobby.status == "playing"
    assert lobby.seats[0].player_token == lobby.host_token
    assert len(games) == 1
    assert received(returning, "game_started")[0]["seat_assignments"] == [
        {"seat_index": 0, "player_token": lobby.host_token}
    ]


def test_returning_member_receives_game_start_missed_while_asleep(
    lobby_sockets, monkeypatch
):
    from hearts_server import lobby_socket

    monkeypatch.setattr(lobby_socket, "create_multiplayer_game", lambda *args: None)
    connect, _ = lobby_sockets
    lobby = create_lobby("Host")
    _, token = join_lobby(lobby.code, "Sleeping friend")
    host = connect(lobby, lobby.host_token)
    friend = connect(lobby, token)
    friend.disconnect(namespace="/lobby")
    host.emit("start_game", {"difficulty": "easy"}, namespace="/lobby")
    friend = connect(lobby, token)
    event = received(friend, "game_started")[0]
    assert event["game_id"] == lobby.game_id
    assert event["seat_assignments"] == [dict(seat_index=1, player_token=token)]
