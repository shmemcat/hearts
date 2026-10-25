"""Real socket clients exercise private views, ownership, recovery and results."""

import copy
import json
import random
from datetime import datetime, timezone

import pytest
from tests.test_shared_accounts import accounts, existing_user, sign_in, post
from hearts.euchre_engine import (
    new_game,
    legal_actions,
    apply_action,
    bot_action,
    effective,
    legal_cards,
    winner,
)


@pytest.fixture
def tables(accounts, monkeypatch):
    from hearts import app, socketio
    from hearts import euchre_multiplayer as mp

    mp._tables.clear()
    mp._clients.clear()
    mp._jobs.clear()
    mp._disconnections.clear()
    tasks = []
    monkeypatch.setattr(
        socketio, "start_background_task", lambda fn: tasks.append(fn) or fn
    )
    monkeypatch.setattr(socketio, "sleep", lambda seconds: None)
    clients = []

    def connect(http=None):
        http = http or app.test_client()
        csrf = http.get("/account/session").json["csrf_token"]
        client = socketio.test_client(
            app, namespace=mp.NS, flask_test_client=http, auth={"csrf": csrf}
        )
        assert client.is_connected(mp.NS)
        clients.append(client)
        return client

    yield connect, tasks, mp
    for client in clients:
        if client.is_connected(mp.NS):
            client.disconnect(namespace=mp.NS)
    mp._tables.clear()
    mp._clients.clear()
    mp._jobs.clear()
    mp._disconnections.clear()


def cmd(client, kind, **data):
    return client.emit(
        "command", dict(type=kind, **data), namespace="/euchre", callback=True
    )


def state(client):
    events = [
        e["args"][0] for e in client.get_received("/euchre") if e["name"] == "state"
    ]
    assert events
    return events[-1]


def join(client, code, seat, name="Guest"):
    assert cmd(client, "watch", code=code)["ok"]
    result = cmd(client, "join", seat=seat, name=name)
    assert result["ok"], result
    return result["token"]


def test_guest_lobbies_default_to_hard_for_fill_in_and_replacement_bots(tables):
    connect, tasks, mp = tables
    host = connect()
    created = cmd(host, "create", name="Guest host", difficulty="hardest")
    table = mp.get_table(created["code"])
    assert state(host)["lobby"]["defaultDifficulty"] == "hard"
    assert table["difficulty"] == "hard"
    assert cmd(host, "start")["ok"]
    assert table["game"]["difficulty"] == "hard"
    assert all(s["bot"] for s in table["seats"][1:])


@pytest.mark.parametrize("human_seats", [(0,), (0, 2), (1, 3), (2, 3)])
def test_fill_in_bots_are_numbered_consecutively_in_every_players_view(
    tables, human_seats
):
    connect, tasks, mp = tables
    host = connect()
    code = cmd(host, "create", name="Host")["code"]
    if human_seats[0] != 0:
        assert cmd(host, "join", seat=human_seats[0], name="Host")["ok"]
    players = [host]
    for seat in human_seats[1:]:
        guest = connect()
        join(guest, code, seat, f"Guest {seat}")
        players.append(guest)
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    expected = [f"Bot {i + 1}" for i in range(4 - len(human_seats))]
    assert [s["name"] for s in table["seats"] if s["bot"]] == expected
    for player, seat in zip(players, human_seats):
        view = state(player)
        assert view["game"]["seatNames"] == [
            table["seats"][(i + seat) % 4]["name"] for i in range(4)
        ]
        assert [
            s["name"] for s in view["lobby"]["seats"] if s["status"] == "ai"
        ] == expected


def test_rematch_renumbers_existing_bots_after_a_human_changes_seats(tables):
    connect, tasks, mp = tables
    host = connect()
    code = cmd(host, "create", name="Host")["code"]
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    table["game"].update(
        phase="game_over",
        scores=[10, 4],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert cmd(host, "rematch")["ok"]
    assert cmd(host, "join", seat=2, name="Host")["ok"]
    assert cmd(host, "start")["ok"]
    assert [s["name"] for s in table["seats"]] == ["Bot 1", "Bot 2", "Host", "Bot 3"]


@pytest.mark.parametrize("hard_level", ["hard", "harder", "hardest"])
def test_creator_hard_preference_survives_host_changes_and_snapshot_reload(
    tables, accounts, existing_user, hard_level
):
    connect, tasks, mp = tables
    sign_in(accounts)
    host, successor = connect(accounts), connect()
    created = cmd(host, "create", difficulty=hard_level)
    code = created["code"]
    assert state(host)["lobby"]["defaultDifficulty"] == hard_level
    join(successor, code, 1, "New host")
    assert cmd(host, "leave")["ok"]
    assert state(successor)["lobby"]["isHost"]
    mp._tables.clear()
    assert cmd(successor, "start")["ok"]
    table = mp.get_table(code)
    assert table["defaultDifficulty"] == hard_level
    assert table["game"]["difficulty"] == hard_level


def test_returning_to_lobby_restores_creator_default_after_an_explicit_override(
    tables, accounts, existing_user
):
    connect, tasks, mp = tables
    sign_in(accounts)
    host = connect(accounts)
    code = cmd(host, "create", difficulty="harder")["code"]
    assert cmd(host, "start", difficulty="medium")["ok"]
    table = mp.get_table(code)
    assert table["game"]["difficulty"] == "medium"
    table["game"].update(
        phase="game_over",
        scores=[10, 4],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert cmd(host, "rematch")["ok"]
    assert cmd(host, "start")["ok"]
    assert table["game"]["difficulty"] == "harder"
    assert table["defaultDifficulty"] == "harder"


def test_closing_a_finished_game_keeps_the_lobby_closed(tables):
    connect, tasks, mp = tables
    host = connect()
    code = cmd(host, "create", name="Host")["code"]
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    table["game"].update(
        phase="game_over",
        scores=[10, 4],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert cmd(host, "close")["ok"]
    assert table["status"] == "closed"
    assert state(host)["lobby"]["status"] == "closed"
    assert cmd(host, "watch", code=code)["ok"]
    assert state(host)["lobby"]["status"] == "closed"


@pytest.mark.parametrize(
    "old_difficulty, expected", [("easy", "hard"), ("hardest", "hardest")]
)
def test_older_lobby_snapshots_get_a_hard_default(tables, old_difficulty, expected):
    connect, tasks, mp = tables
    host = connect()
    code = cmd(host, "create", name="Host")["code"]
    table = mp.get_table(code)
    table.pop("defaultDifficulty")
    table["difficulty"] = old_difficulty
    mp.save(table)
    mp._tables.clear()
    assert cmd(host, "start")["ok"]
    assert mp.get_table(code)["game"]["difficulty"] == expected


def test_team_names_visible_and_first_teammate_only(tables):
    connect, tasks, mp = tables
    host, guest, partner = connect(), connect(), connect()
    created = cmd(host, "create", name="Host")
    code = created["code"]
    join(guest, code, 3, "West")
    join(partner, code, 2, "Partner")
    assert cmd(host, "name", name="Moon Cats")["ok"]
    assert cmd(guest, "name", name="Star Foxes")["ok"]
    assert not cmd(partner, "name", name="Stolen name")["ok"]
    view = state(partner)["lobby"]
    assert [t["name"] for t in view["teams"]] == ["Moon Cats", "Star Foxes"]
    assert all(not t["canName"] for t in view["teams"])
    assert "token" not in json.dumps(view)
    assert not cmd(host, "name", name="x" * 25)["ok"]
    assert not cmd(guest, "start")["ok"]


def test_moving_seats_transfers_naming_rights_and_cannot_take_occupied_seat(tables):
    connect, tasks, mp = tables
    host, partner = connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    join(partner, code, 2)
    assert not cmd(partner, "join", seat=0, name="Guest")["ok"]
    assert cmd(host, "join", seat=1, name="")["ok"]
    assert cmd(partner, "name", name="Partner's team")["ok"]
    assert cmd(host, "name", name="Host's team")["ok"]
    assert state(host)["lobby"]["isHost"]


def test_private_rotated_game_views_and_action_validation(tables):
    connect, tasks, mp = tables
    clients = [connect() for _ in range(4)]
    code = cmd(clients[0], "create", name="Host")["code"]
    for i in range(1, 4):
        join(clients[i], code, i, f"Player {i}")
    assert cmd(clients[0], "start", difficulty="medium")["ok"]
    table = mp.get_table(code)
    for i, client in enumerate(clients):
        view = state(client)
        assert view["game"]["hands"][0] == table["game"]["hands"][i]
        assert all(c is None for h in view["game"]["hands"][1:] for c in h)
        assert view["game"]["kitty"] == []
        assert view["game"]["dealer"] == (table["game"]["dealer"] - i) % 4
        assert view["game"]["seatNames"][0] == table["seats"][i]["name"]
        assert "userId" not in json.dumps(view)
    turn = table["game"]["turn"]
    action = dict(type="pass")
    rev = table["revision"]
    assert not cmd(clients[(turn + 1) % 4], "action", action=action, revision=rev)["ok"]
    assert cmd(clients[turn], "action", action=action, revision=rev)["ok"]
    assert not cmd(clients[turn], "action", action=action, revision=rev)["ok"]


@pytest.mark.parametrize("dealer", range(4))
def test_pass_out_summaries_redeal_then_rotate_after_snapshot_reload(tables, dealer):
    connect, tasks, mp = tables
    clients = [connect() for _ in range(4)]
    code = cmd(clients[0], "create", name="Host")["code"]
    for i in range(1, 4):
        join(clients[i], code, i, f"Player {i}")
    assert cmd(clients[0], "start", difficulty="medium")["ok"]
    table = mp.get_table(code)
    table["game"].update(dealer=dealer, turn=(dealer + 1) % 4, scores=[3, 5])
    for hand in range(4):
        original = copy.deepcopy(table["game"])
        for _ in range(8):
            turn = table["game"]["turn"]
            reply = cmd(
                clients[turn],
                "action",
                action=dict(type="pass"),
                revision=table["revision"],
            )
            assert reply["ok"], reply
        game = table["game"]
        assert game["phase"] == "round_complete"
        assert game["message"] == (
            "No calls — Pass" if hand % 2 else "No calls — Re-deal"
        )
        assert game["dealer"] == original["dealer"]
        assert game["hands"] == original["hands"]
        assert game["handNumber"] == original["handNumber"]
        assert game["scores"] == [3, 5] and game["results"] == []
        for i, client in enumerate(clients):
            view = state(client)["game"]
            assert view["message"] == game["message"]
            assert view["dealer"] == (game["dealer"] - i) % 4
            assert view["scores"] == ([3, 5] if i % 2 == 0 else [5, 3])
        assert not cmd(
            clients[1],
            "action",
            action=dict(type="advance"),
            revision=table["revision"],
        )["ok"]
        # Recover the pending summary and counter from the persisted snapshot.
        mp._tables.clear()
        table = mp.get_table(code)
        assert table["game"] == game
        assert cmd(
            clients[0],
            "action",
            action=dict(type="advance"),
            revision=table["revision"],
        )["ok"]
        game = table["game"]
        assert game["phase"] == "bidding1"
        assert game["dealer"] == (
            (original["dealer"] + 1) % 4 if hand % 2 else original["dealer"]
        )
        assert game["turn"] == (game["dealer"] + 1) % 4
        assert game["consecutivePassOuts"] == (0 if hand % 2 else 1)
        assert game["handNumber"] == original["handNumber"] + 1
        assert game["scores"] == [3, 5] and game["results"] == []
        assert [len(h) for h in game["hands"]] == [5, 5, 5, 5]


def test_disconnect_grace_bot_takeover_reconnect_and_host_migration(tables):
    connect, tasks, mp = tables
    host, guest = connect(), connect()
    created = cmd(host, "create", name="Host")
    code, token = created["code"], created["token"]
    join(guest, code, 1)
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    host.disconnect(namespace=mp.NS)
    expire = tasks[-1]
    assert not table["seats"][0]["bot"]
    restored = connect()
    assert cmd(restored, "watch", code=code, token=token)["ok"]
    expire()
    assert not table["seats"][0]["bot"]
    restored.disconnect(namespace=mp.NS)
    tasks[-1]()
    assert table["seats"][0]["bot"]
    assert table["host"] != token
    assert table["participants"][0]["conceded"]
    recovered = connect()
    assert cmd(recovered, "watch", code=code, token=token)["ok"]
    assert not table["seats"][0]["bot"]
    assert not table["participants"][0]["conceded"]


def test_explicit_departure_cannot_reclaim_or_name_team(tables):
    connect, tasks, mp = tables
    host, partner = connect(), connect()
    created = cmd(host, "create", name="Host")
    code = created["code"]
    join(partner, code, 2)
    assert cmd(host, "start")["ok"]
    assert cmd(host, "leave")["ok"]
    assert mp.get_table(code)["seats"][0]["bot"]
    assert cmd(host, "watch", code=code, token=created["token"])["ok"]
    assert state(host)["lobby"]["seat"] is None
    assert not cmd(host, "name", name="Nope")["ok"]


def test_snapshot_recovery_preserves_invite_seats_and_team_names(tables):
    connect, tasks, mp = tables
    host = connect()
    created = cmd(host, "create", name="Host")
    assert cmd(host, "name", name="Saved Stars")["ok"]
    assert cmd(host, "start")["ok"]
    original = copy.deepcopy(mp.get_table(created["code"]))
    mp._tables.clear()
    assert mp.get_table(created["code"]) == original
    assert cmd(host, "watch", code=created["code"], token=created["token"])["ok"]
    assert state(host)["game"]["teamNames"][0] == "Saved Stars"


def test_results_are_server_owned_deduplicated_and_separate_from_hearts(
    tables, accounts, existing_user
):
    from hearts.models import EuchreGameResult, UserStats, GameResult

    connect, tasks, mp = tables
    sign_in(accounts)
    host, guest = connect(accounts), connect()
    created = cmd(host, "create", name="Ignored")
    code = created["code"]
    join(guest, code, 1)
    assert cmd(host, "name", name="Moon Cats")["ok"]
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    table["game"].update(
        phase="game_over",
        scores=[10, 6],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    mp.record_results(table)
    mp.save(table)
    assert EuchreGameResult.query.count() == 1
    assert EuchreGameResult.query.one().won
    assert UserStats.query.filter_by(user_id=42).one().games_won == 3
    assert GameResult.query.count() == 0
    board = accounts.get("/account/euchre/leaderboard?category=multiplayer").json
    assert board["all_time"][0]["games_won"] == 1
    stats = accounts.get("/account/euchre/multiplayer-results").json
    assert stats["results"][0]["difficulty"] == "multiplayer"
    assert stats["results"][0]["won"]
    assert not cmd(guest, "rematch")["ok"]
    assert cmd(host, "rematch")["ok"]
    assert table["status"] == "waiting"
    assert table["teams"][0]["name"] == "Moon Cats"
    assert table["seats"][1]["name"] == "Guest"
    assert cmd(host, "start")["ok"]
    assert table["game"]["id"] != stats["results"][0]["id"]


def test_account_identity_comes_from_cookie_and_cannot_occupy_two_seats(
    tables, accounts, existing_user
):
    connect, tasks, mp = tables
    sign_in(accounts)
    host, same_user, stranger = connect(accounts), connect(accounts), connect()
    created = cmd(host, "create", name="Spoofed")
    table = mp.get_table(created["code"])
    assert table["seats"][0]["userId"] == 42
    assert table["seats"][0]["name"] == "existing_hearts"
    assert cmd(same_user, "watch", code=created["code"])["ok"]
    assert not cmd(same_user, "join", seat=2, name="Spoofed")["ok"]
    assert not cmd(stranger, "watch", code=created["code"], token=created["token"])[
        "ok"
    ]


def test_left_bower_follow_suit_and_lone_scoring():
    assert effective("Jd", "h") == "h"
    assert legal_cards(["Jd", "9d"], [dict(seat=0, card="Ah")], "h") == ["Jd"]
    assert winner([dict(seat=0, card="Ah"), dict(seat=1, card="Jd")], "h") == 1
    g = new_game(rng=random.Random(1))
    g.update(
        phase="trick_complete",
        maker=1,
        alone=True,
        trump="h",
        tricks=[0, 5],
        completedTricks=[{}] * 5,
        scores=[0, 6],
    )
    result = apply_action(g, dict(type="advance"))
    assert result["scores"] == [0, 10]
    assert result["phase"] == "game_over"


def test_sign_out_revokes_existing_socket(tables, accounts, existing_user):
    connect, tasks, mp = tables
    sign_in(accounts)
    host = connect(accounts)
    assert cmd(host, "create", name="Ignored")["ok"]
    assert post(accounts, "logout").status_code == 200
    assert not cmd(host, "start")["ok"]


def test_cookie_connection_requires_csrf(accounts):
    from hearts import app, socketio

    accounts.get("/account/session")
    rejected = socketio.test_client(
        app, namespace="/euchre", flask_test_client=accounts, auth={"csrf": "wrong"}
    )
    assert not rejected.is_connected("/euchre")


def test_last_player_leaving_finishes_as_loss(tables, accounts, existing_user):
    from hearts.models import EuchreGameResult

    connect, tasks, mp = tables
    sign_in(accounts)
    host = connect(accounts)
    created = cmd(host, "create", name="Ignored")
    assert cmd(host, "start")["ok"]
    assert cmd(host, "leave")["ok"]
    assert mp.get_table(created["code"])["status"] == "finished"
    result = EuchreGameResult.query.one()
    assert result.conceded and not result.won


def test_bot_runner_advances_automatically_after_human_action(tables):
    connect, tasks, mp = tables
    host = connect()
    created = cmd(host, "create", name="Host")
    code = created["code"]
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    g = table["game"]
    # A completed trick is advanced exclusively by the service.
    g.update(phase="trick_complete", turn=1, completedTricks=[dict(plays=[], winner=1)])
    mp._jobs.clear()
    assert cmd(host, "watch", code=code, token=created["token"])["ok"]
    tasks[-1]()
    assert table["game"]["phase"] == "playing"


@pytest.mark.parametrize("difficulty", ["easy", "medium"])
def test_seeded_bot_games_finish_with_legal_actions(difficulty):
    for seed in range(5):
        rng = random.Random(seed)
        game = new_game(difficulty, rng)
        for _ in range(2000):
            if game["phase"] == "game_over":
                break
            action = bot_action(game, rng)
            assert action in legal_actions(game)
            game = apply_action(game, action, rng)
        assert game["phase"] == "game_over"


def test_hard_bot_ignores_real_hidden_hands():
    g = new_game("hard", random.Random(2))
    changed = copy.deepcopy(g)
    seat = g["turn"]
    other_seats = [i for i in range(4) if i != seat]
    cards = [c for i in other_seats for c in changed["hands"][i]]
    cards.reverse()
    for i, other in enumerate(other_seats):
        changed["hands"][other] = cards[i * 5 : (i + 1) * 5]
    assert bot_action(g, random.Random(7)) == bot_action(changed, random.Random(7))


def test_both_signed_in_teammates_get_the_win(tables, accounts, existing_user):
    from hearts import app
    from hearts.extensions import db
    from hearts.models import User, EuchreGameResult

    connect, tasks, mp = tables
    db.session.add(
        User(
            id=43,
            username="partner",
            email="partner@example.test",
            email_verified=True,
            password_hash=existing_user.password_hash,
        )
    )
    db.session.commit()
    sign_in(accounts)
    partner_http = app.test_client()
    assert sign_in(partner_http, "partner").status_code == 200
    host, partner = connect(accounts), connect(partner_http)
    code = cmd(host, "create", name="Ignored")["code"]
    join(partner, code, 2)
    assert cmd(host, "start")["ok"]
    table = mp.get_table(code)
    table["game"].update(
        phase="game_over",
        scores=[10, 7],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert {(r.user_id, r.won, r.score) for r in EuchreGameResult.query.all()} == {
        (42, True, 10),
        (43, True, 10),
    }
    assert (
        accounts.get("/account/euchre/leaderboard?category=easy").json["all_time"] == []
    )


def test_multiplayer_migration_preserves_accounts_and_existing_results():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect, text

    source = (
        Path(__file__).parents[1] / "migrations/versions/019_add_euchre_multiplayer.py"
    )
    spec = importlib.util.spec_from_file_location(
        "euchre_multiplayer_migration", source
    )
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)")
        )
        connection.execute(text("INSERT INTO users VALUES (42, 'existing_account')"))
        connection.execute(
            text(
                "CREATE TABLE euchre_game_results (id INTEGER PRIMARY KEY, user_id INTEGER, won BOOLEAN)"
            )
        )
        connection.execute(text("INSERT INTO euchre_game_results VALUES (1, 42, 1)"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        assert "euchre_tables" in inspect(connection).get_table_names()
        assert connection.execute(
            text(
                "SELECT user_id, won, marches, loners, euchres FROM euchre_game_results"
            )
        ).one() == (42, 1, 0, 0, 0)
        with Operations.context(MigrationContext.configure(connection)):
            migration.downgrade()
        assert "euchre_tables" not in inspect(connection).get_table_names()
        assert (
            connection.execute(text("SELECT username FROM users")).scalar()
            == "existing_account"
        )


def test_joining_another_table_requires_leaving_the_current_group(tables):
    connect, tasks, mp = tables
    host, other = connect(), connect()
    first = cmd(host, "create", name="Host")
    second = cmd(other, "create", name="Other")
    assert not cmd(host, "join", code=second["code"], seat=1, name="Ghost")["ok"]
    assert mp.get_table(first["code"])["seats"][0]["token"] == first["token"]


@pytest.mark.parametrize("departure", ["leave", "disconnect"])
@pytest.mark.parametrize("first_action", ["move", "unseat", "reconnect"])
def test_host_succession_keeps_arrival_order_through_seat_changes_and_reload(
    tables, departure, first_action
):
    connect, tasks, mp = tables
    host, first, later = connect(), connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    # Arrival order starts in the waiting room, before choosing a seat.
    first_token = cmd(first, "watch", code=code)["token"]
    join(later, code, 1, "Later")
    assert cmd(first, "join", seat=3, name="First")["ok"]

    if first_action == "move":
        assert cmd(first, "join", seat=2)["ok"]
    elif first_action == "unseat":
        assert cmd(first, "unseat")["ok"]
    else:
        first.disconnect(namespace=mp.NS)
        first = connect()
        assert cmd(first, "watch", code=code, token=first_token)["ok"]
        tasks[-1]()

    mp._tables.clear()
    if departure == "leave":
        assert cmd(host, "leave")["ok"]
    else:
        host.disconnect(namespace=mp.NS)
        tasks[-1]()

    assert mp.get_table(code)["host"] == first_token
    assert state(first)["lobby"]["isHost"]
    assert not state(later)["lobby"]["isHost"]
    assert not cmd(later, "close")["ok"]
    if first_action == "unseat":
        assert cmd(first, "join", seat=0)["ok"]
    assert cmd(first, "start")["ok"]


def test_leaving_and_rejoining_moves_to_end_of_host_succession(tables):
    connect, tasks, mp = tables
    host, returning, next_host = connect(), connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    old_token = join(returning, code, 3, "Returning")
    next_token = join(next_host, code, 2, "Next host")
    assert cmd(returning, "leave")["ok"]
    new_token = join(returning, code, 1, "Returning")
    assert new_token != old_token

    assert cmd(host, "leave")["ok"]
    assert mp.get_table(code)["host"] == next_token
    assert cmd(next_host, "leave")["ok"]
    assert mp.get_table(code)["host"] == new_token
    assert cmd(returning, "close")["ok"]


def test_host_succession_supports_snapshots_without_lobby_arrival_order(tables):
    connect, tasks, mp = tables
    host, first, later = connect(), connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    first_token = join(first, code, 3, "First")
    join(later, code, 1, "Later")
    table = mp.get_table(code)
    for member in mp.members(table):
        member.pop("lobbyJoined", None)
    mp.save(table)
    mp._tables.clear()

    assert cmd(host, "leave")["ok"]
    assert mp.get_table(code)["host"] == first_token


def test_changing_teams_does_not_take_naming_rights_from_the_first_teammate(tables):
    connect, tasks, mp = tables
    host, first = connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    join(first, code, 1, "First opponent")
    assert cmd(host, "join", seat=3)["ok"]
    assert not cmd(host, "name", name="Host steals the name")["ok"]
    assert cmd(first, "name", name="First teammate's choice")["ok"]


def test_returning_after_game_completion_does_not_rewrite_a_forfeit(tables):
    connect, tasks, mp = tables
    host, opponent = connect(), connect()
    created = cmd(host, "create", name="Host")
    join(opponent, created["code"], 1)
    assert cmd(host, "start")["ok"]
    table = mp.get_table(created["code"])
    table["participants"][0]["conceded"] = True
    table["game"].update(
        phase="game_over",
        scores=[10, 4],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert cmd(host, "watch", code=created["code"], token=created["token"])["ok"]
    assert table["participants"][0]["conceded"]
    assert state(host)["game"]["conceded"]


def test_full_lobby_can_trade_seats_without_leaving_the_group(tables):
    connect, tasks, mp = tables
    players = [connect() for _ in range(4)]
    created = cmd(players[0], "create", name="Host")
    code = created["code"]
    for i in range(1, 4):
        join(players[i], code, i, f"Player {i}")
    assert cmd(players[0], "name", name="Moon Cats")["ok"]
    assert cmd(players[0], "unseat")["ok"]
    view = state(players[0])["lobby"]
    assert view["seat"] is None and view["isMember"] and view["isHost"]
    assert view["unseated"] == [
        dict(name="Host", mine=True, host=True, connected=True, reserved=True)
    ]
    assert "token" not in json.dumps(view)
    assert not cmd(players[0], "start")["ok"]
    assert cmd(players[1], "unseat")["ok"]
    assert cmd(players[0], "join", seat=1)["ok"]
    assert not cmd(players[0], "start")["ok"]
    assert cmd(players[1], "join", seat=0)["ok"]
    table = mp.get_table(code)
    assert [s["name"] for s in table["seats"]] == [
        "Player 1",
        "Host",
        "Player 2",
        "Player 3",
    ]
    assert table["host"] == created["token"]
    assert table["unseated"] == {}
    assert table["teams"][0]["name"] == "Moon Cats"
    assert cmd(players[0], "start")["ok"]
    assert not cmd(players[0], "unseat")["ok"]


def test_unseated_member_reconnects_and_keeps_their_guest_name(tables):
    connect, tasks, mp = tables
    host, guest = connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    token = join(guest, code, 1, "Remember me")
    assert cmd(guest, "unseat")["ok"]
    guest.disconnect(namespace=mp.NS)
    expire = tasks[-1]
    mp._tables.clear()  # Recovery includes the saved unseated membership.
    restored = connect()
    assert cmd(restored, "watch", code=code, token=token)["ok"]
    expire()
    assert state(restored)["lobby"]["isMember"]
    assert cmd(restored, "join", seat=2)["ok"]
    assert mp.get_table(code)["seats"][2]["name"] == "Remember me"


def test_unseated_player_can_leave_and_disconnected_host_is_replaced(tables):
    connect, tasks, mp = tables
    host, guest = connect(), connect()
    created = cmd(host, "create", name="Host")
    code = created["code"]
    join(guest, code, 1)
    assert cmd(host, "unseat")["ok"]
    assert not cmd(host, "create", name="Another table")["ok"]
    host.disconnect(namespace=mp.NS)
    tasks[-1]()
    assert mp.get_table(code)["unseated"] == {}
    assert state(guest)["lobby"]["isHost"]
    assert cmd(guest, "unseat")["ok"]
    assert cmd(guest, "leave")["ok"]
    assert not state(guest)["lobby"]["isMember"]


def test_open_seat_is_reserved_for_members_during_a_full_group_swap(tables):
    connect, tasks, mp = tables
    players = [connect() for _ in range(5)]
    code = cmd(players[0], "create", name="Host")["code"]
    for i in range(1, 4):
        join(players[i], code, i)
    assert cmd(players[0], "unseat")["ok"]
    assert cmd(players[4], "watch", code=code)["ok"]
    assert not cmd(players[4], "join", seat=0, name="Outsider")["ok"]
    assert cmd(players[0], "join", seat=0)["ok"]


def test_play_again_immediately_rematches_same_group_and_preserves_results(
    tables, accounts, existing_user
):
    from hearts.models import EuchreGameResult

    connect, tasks, mp = tables
    sign_in(accounts)
    host, guest = connect(accounts), connect()
    code = cmd(host, "create", name="Ignored")["code"]
    join(guest, code, 1)
    assert cmd(host, "name", name="Same partners")["ok"]
    assert cmd(host, "start", difficulty="medium")["ok"]
    table = mp.get_table(code)
    old_id = table["game"]["id"]
    old_seats = copy.deepcopy(table["seats"])
    table["game"].update(
        phase="game_over",
        scores=[10, 4],
        finishedAt=datetime.now(timezone.utc).isoformat(),
    )
    mp.record_results(table)
    mp.save(table)
    assert not cmd(guest, "play_again")["ok"]
    assert cmd(host, "play_again")["ok"]
    assert table["status"] == "playing" and table["game"]["id"] != old_id
    assert table["game"]["difficulty"] == "medium"
    assert table["seats"] == old_seats
    assert table["teams"][0]["name"] == "Same partners"
    assert EuchreGameResult.query.one().game_id == old_id
    assert EuchreGameResult.query.one().won
    assert not cmd(host, "play_again")["ok"]


def test_new_arrivals_appear_in_waiting_room_and_can_name_themselves(tables):
    connect, tasks, mp = tables
    host, arrival = connect(), connect()
    code = cmd(host, "create", name="Host")["code"]
    watched = cmd(arrival, "watch", code=code)
    assert watched["ok"] and watched["token"]
    view = state(arrival)["lobby"]
    assert view["isMember"] and view["seat"] is None and view["needsName"]
    assert view["unseated"] == [
        dict(name="Guest", mine=True, host=False, connected=True, reserved=False)
    ]
    assert cmd(arrival, "rename", name="New friend")["ok"]
    assert state(host)["lobby"]["unseated"][0]["name"] == "New friend"
    assert cmd(arrival, "join", seat=2)["ok"]
    assert mp.get_table(code)["seats"][2]["name"] == "New friend"
    assert state(host)["lobby"]["unseated"] == []


def test_waiting_room_allows_extra_players_without_blocking_a_seated_game(tables):
    connect, tasks, mp = tables
    players = [connect() for _ in range(6)]
    code = cmd(players[0], "create", name="Host")["code"]
    for i in range(1, 4):
        join(players[i], code, i)
    for player in players[4:]:
        assert cmd(player, "watch", code=code)["ok"]
    assert len(state(players[0])["lobby"]["unseated"]) == 2
    assert cmd(players[0], "start")["ok"]
    assert state(players[4])["game"] is None
    assert cmd(players[4], "leave")["ok"]
    assert len(state(players[0])["lobby"]["unseated"]) == 1
    players[5].disconnect(namespace=mp.NS)
    tasks[-1]()
    assert state(players[0])["lobby"]["unseated"] == []


def test_signed_in_arrival_uses_account_name_and_waiting_room_survives_reload(
    tables, accounts, existing_user
):
    connect, tasks, mp = tables
    host = connect()
    code = cmd(host, "create", name="Host")["code"]
    sign_in(accounts)
    arrival = connect(accounts)
    watched = cmd(arrival, "watch", code=code)
    assert state(host)["lobby"]["unseated"][0]["name"] == "existing_hearts"
    arrival.disconnect(namespace=mp.NS)
    mp._tables.clear()
    restored = connect(accounts)
    assert cmd(restored, "watch", code=code, token=watched["token"])["ok"]
    view = state(restored)["lobby"]
    assert len(view["unseated"]) == 1
    assert view["memberName"] == "existing_hearts"
    assert not view["needsName"]
