"""Private Euchre tables on the shared service; a single worker owns timers.

Only the server deals, validates moves and records multiplayer results. Public
snapshots never contain seat credentials, account IDs, kitty or opponents' cards.
"""

import copy
import json
import secrets
import time
from datetime import datetime, timedelta, timezone

from eventlet.semaphore import Semaphore
from flask import request
from hearts.account_sessions import current_session, session_user, valid_origin
from hearts.extensions import db
from hearts.models import EuchreTable, EuchreGameResult, User
from hearts.euchre_engine import new_game, apply_action, bot_action

NS = "/euchre"
GRACE_SECONDS = 30
TTL_SECONDS = 20 * 60
_tables = {}
_clients = {}
_jobs = {}
_disconnections = {}
_lock = Semaphore()


def save(table):
    table["touched"] = time.time()
    row = db.session.get(EuchreTable, table["code"])
    if row is None:
        row = EuchreTable(code=table["code"])
        db.session.add(row)
    row.snapshot = json.dumps(table)
    row.updated_at = datetime.utcnow()
    db.session.commit()


def get_table(code):
    if not isinstance(code, str):
        raise ValueError("Enter a lobby code.")
    code = code.strip().upper()
    table = _tables.get(code)
    if not table:
        row = db.session.get(EuchreTable, code)
        if row:
            table = json.loads(row.snapshot)
            _tables[code] = table
    if not table or time.time() - table["touched"] > TTL_SECONDS:
        raise ValueError("Lobby not found or expired.")
    table.setdefault("unseated", {})
    table.setdefault(
        "defaultDifficulty",
        (
            table.get("difficulty")
            if table.get("difficulty") in ("hard", "harder", "hardest")
            else "hard"
        ),
    )
    return table


def text(value, label, maximum):
    if not isinstance(value, str):
        raise ValueError(f"Enter {label}.")
    value = " ".join(value.split())
    if not 1 <= len(value) <= maximum or any(ord(c) < 32 for c in value):
        raise ValueError(f"Use 1–{maximum} characters for {label}.")
    return value


def connected(token):
    return any(c.get("token") == token for c in _clients.values())


def seat_for(table, token):
    return next(
        (
            i
            for i, s in enumerate(table["seats"])
            if s and token and s.get("token") == token
        ),
        None,
    )


def member_for(table, token):
    index = seat_for(table, token)
    return (
        table["seats"][index]
        if index is not None
        else table.get("unseated", {}).get(token)
    )


def members(table):
    return [s for s in table["seats"] if s and s.get("token")] + list(
        table.get("unseated", {}).values()
    )


def reserved_members(table):
    return [s for s in table["seats"] if s and s.get("token")] + [
        s for s in table.get("unseated", {}).values() if s.get("reserved", True)
    ]


def captains(table):
    # Earliest human on each partnership has naming rights. Transfer on departure.
    for side in range(2):
        humans = [
            s
            for i, s in enumerate(table["seats"])
            if i % 2 == side and s and s.get("token") and not s.get("bot")
        ]
        table["teams"][side]["captain"] = (
            min(humans, key=lambda s: s["joined"])["token"] if humans else None
        )


def migrate_host(table):
    humans = [s for s in members(table) if not s.get("bot")]
    seated = [s for s in table["seats"] if s and s.get("token") and not s.get("bot")]
    if table["status"] == "playing" and seated:
        humans = seated
    if not any(s["token"] == table["host"] for s in humans):
        table["host"] = (
            min(humans, key=lambda s: s["joined"])["token"] if humans else None
        )


def public(table, token):
    mine = seat_for(table, token)
    seats = []
    for i, s in enumerate(table["seats"]):
        seats.append(
            dict(
                index=i,
                status="empty" if s is None else "ai" if s.get("bot") else "human",
                name=s["name"] if s else "Waiting…",
                icon=s.get("icon", "user") if s else "user",
                mine=mine == i,
                host=bool(s and s.get("token") and s["token"] == table["host"]),
                connected=bool(s and s.get("token") and connected(s["token"])),
            )
        )
    return dict(
        code=table["code"],
        status=table["status"],
        seats=seats,
        seat=mine,
        isMember=member_for(table, token) is not None,
        memberName=(member_for(table, token) or {}).get("name", ""),
        needsName=not (member_for(table, token) or {}).get("named", True),
        unseated=[
            dict(
                name=s["name"],
                mine=s["token"] == token,
                host=s["token"] == table["host"],
                connected=connected(s["token"]),
                reserved=s.get("reserved", True),
            )
            for s in table.get("unseated", {}).values()
        ],
        isHost=bool(token and table["host"] == token),
        revision=table["revision"],
        teams=[
            dict(
                name=t["name"],
                canName=bool(token and t["captain"] == token),
                named=t["named"],
            )
            for t in table["teams"]
        ],
        gameId=table["game"]["id"] if table["game"] else None,
        difficulty=table["difficulty"],
        defaultDifficulty=table["defaultDifficulty"],
    )


def game_view(table, token):
    seat = seat_for(table, token)
    if seat is None or not table["game"]:
        return None
    g = copy.deepcopy(table["game"])
    rotate = lambda s: (s - seat) % 4 if s is not None else None
    side = seat % 2
    # Null placeholders reveal counts, never identities. Own hand is always index 0.
    g["hands"] = [
        (
            list(g["hands"][(i + seat) % 4])
            if i == 0
            else [None] * len(g["hands"][(i + seat) % 4])
        )
        for i in range(4)
    ]
    g["kitty"] = []
    for key in ("turn", "dealer", "maker", "sittingOut"):
        g[key] = rotate(g[key])
    for p in g["trick"]:
        p["seat"] = rotate(p["seat"])
    for trick in g["completedTricks"]:
        trick["winner"] = rotate(trick["winner"])
        for p in trick["plays"]:
            p["seat"] = rotate(p["seat"])
    for r in g["results"]:
        r["maker"] = rotate(r["maker"])
        for key in ("tricks", "points", "scores"):
            r[key] = [r[key][side], r[key][1 - side]]
    for key in ("scores", "tricks"):
        g[key] = [g[key][side], g[key][1 - side]]
    seats = [
        table["seats"][(i + seat) % 4] or dict(name="Departed player", bot=True)
        for i in range(4)
    ]
    g["seatNames"] = [s["name"] for s in seats]
    g["seatIcons"] = [s.get("icon", "user") for s in seats]
    g["humanSeats"] = [not s.get("bot") for s in seats]
    g["teamNames"] = [table["teams"][i]["name"] for i in (side, 1 - side)]
    g["playerName"] = seats[0]["name"]
    participant = next((p for p in table["participants"] if p["token"] == token), None)
    if g["phase"] == "game_over" and participant and participant["conceded"]:
        g["conceded"] = True
        g["message"] = "Your seat was replaced by a bot. This game counts as a loss."
    if g["message"].startswith("Seat "):
        for i, s in enumerate(table["seats"]):
            g["message"] = g["message"].replace(f"Seat {i + 1} ", s["name"] + " ")
    return g


def record_results(table):
    g = table["game"]
    if g["phase"] != "game_over":
        return
    for p in table["participants"]:
        user_id = p.get("userId")
        if not user_id or not db.session.get(User, user_id):
            continue
        if EuchreGameResult.query.filter_by(user_id=user_id, game_id=g["id"]).first():
            continue
        side = p["seat"] % 2
        db.session.add(
            EuchreGameResult(
                user_id=user_id,
                game_id=g["id"],
                difficulty="multiplayer",
                won=not p["conceded"] and g["scores"][side] >= 10,
                conceded=p["conceded"],
                score=g["scores"][side],
                opponent_score=g["scores"][1 - side],
                marches=sum(
                    r["maker"] % 2 == side and not r["alone"] and r["tricks"][side] == 5
                    for r in g["results"]
                ),
                loners=sum(
                    r["maker"] % 2 == side and r["alone"] and r["tricks"][side] == 5
                    for r in g["results"]
                ),
                euchres=sum(
                    r["maker"] % 2 != side and r["tricks"][1 - side] < 3
                    for r in g["results"]
                ),
                completed_at=datetime.fromisoformat(g["finishedAt"]).replace(
                    tzinfo=None
                ),
            )
        )
    if table["status"] != "closed":
        table["status"] = "finished"


def start_match(table, difficulty):
    if any(s.get("reserved", True) for s in table.get("unseated", {}).values()):
        raise ValueError("Everyone in the group must choose a seat before starting.")
    if seat_for(table, table["host"]) is None:
        raise ValueError("Choose a seat before starting the game.")
    if difficulty not in ("easy", "medium", "hard", "harder", "hardest"):
        raise ValueError("Choose a bot difficulty.")
    table["difficulty"] = difficulty
    for i, s in enumerate(table["seats"]):
        if s is None:
            table["seats"][i] = dict(name=f"Bot {i+1}", icon="robot", bot=True)
    table["participants"] = [
        dict(token=s["token"], userId=s.get("userId"), seat=i, conceded=False)
        for i, s in enumerate(table["seats"])
        if s.get("token")
    ]
    table.update(game=new_game(difficulty), status="playing")


def register_euchre_socket(socketio):
    from hearts import app

    def broadcast(table):
        for sid, client in list(_clients.items()):
            if client.get("code") == table["code"]:
                socketio.emit(
                    "state",
                    dict(
                        lobby=public(table, client.get("token")),
                        game=game_view(table, client.get("token")),
                    ),
                    to=sid,
                    namespace=NS,
                )

    def changed(table):
        if table["status"] == "playing" and not any(
            s and s.get("token") and not s.get("bot") for s in table["seats"]
        ):
            table["game"].update(
                phase="game_over",
                conceded=True,
                finishedAt=datetime.now(timezone.utc).isoformat(),
                message="All players have left the game.",
            )
        table["revision"] += 1
        record_results(table) if table["game"] else None
        save(table)
        broadcast(table)
        schedule(table)

    def schedule(table):
        code = table["code"]
        if code in _jobs or table["status"] != "playing":
            return
        g = table["game"]
        automatic = g["phase"] == "trick_complete" or table["seats"][g["turn"]].get(
            "bot"
        )
        if not automatic or g["phase"] in ("game_over", "round_complete"):
            return
        revision = table["revision"]

        def run():
            socketio.sleep(1.8 if g["phase"] == "trick_complete" else 1.1)
            with app.app_context(), _lock:
                try:
                    current = get_table(code)
                except ValueError:
                    _jobs.pop(code, None)
                    return
                if current["revision"] != revision or current["status"] != "playing":
                    _jobs.pop(code, None)
                    schedule(current)
                    return
                observation = copy.deepcopy(current["game"])
            # Simulations yield between sampled deals, outside the table lock.
            # Another table or reconnect can proceed while this bot thinks.
            action = bot_action(observation, cooperate=lambda: socketio.sleep(0))
            with app.app_context(), _lock:
                _jobs.pop(code, None)
                if current["revision"] == revision and current["status"] == "playing":
                    current["game"] = apply_action(current["game"], action)
                    changed(current)
                else:
                    schedule(current)

        _jobs[code] = socketio.start_background_task(run)

    def recover_disconnections(table):
        # Also starts grace timers for seats restored after a service restart.
        for s in members(table):
            if s and s.get("token") and not s.get("bot") and not connected(s["token"]):
                expire_after(table["code"], s["token"])

    def expire_after(code, token):
        if connected(token) or token in _disconnections:
            return
        stamp = time.monotonic()
        _disconnections[token] = stamp

        def expire():
            socketio.sleep(GRACE_SECONDS)
            with app.app_context(), _lock:
                try:
                    table = get_table(code)
                except ValueError:
                    return
                index = seat_for(table, token)
                if (
                    member_for(table, token) is None
                    or connected(token)
                    or _disconnections.get(token) != stamp
                ):
                    return
                _disconnections.pop(token, None)
                if table["status"] == "playing" and index is not None:
                    table["seats"][index]["bot"] = True
                    for p in table["participants"]:
                        if p["token"] == token:
                            p["conceded"] = True
                elif index is not None:
                    table["seats"][index] = None
                else:
                    table["unseated"].pop(token, None)
                captains(table)
                migrate_host(table)
                changed(table)

        socketio.start_background_task(expire)

    @socketio.on("connect", namespace=NS)
    def connect(auth=None):
        auth = auth if isinstance(auth, dict) else {}
        if app.config.get("CARDS_ACCOUNT_ENABLED"):
            # Same-origin polling GETs omit Origin. Cookie sessions still require
            # the CSRF secret; any supplied Origin must match the Cards origins.
            if request.headers.get("Origin") and not valid_origin():
                return False
            session = current_session()
            if session and (
                not isinstance(auth.get("csrf"), str)
                or not secrets.compare_digest(session.csrf_token, auth["csrf"])
            ):
                return False
        user = session_user()
        _clients[request.sid] = dict(
            userId=user.id if user else None,
            name=user.username if user else None,
            icon=user.profile_icon if user else "user",
            events=[],
        )

    @socketio.on("disconnect", namespace=NS)
    def disconnect(reason=None):
        client = _clients.pop(request.sid, None)
        if client and client.get("token"):
            with _lock:
                try:
                    table = get_table(client["code"])
                    broadcast(table)
                    expire_after(client["code"], client["token"])
                except ValueError:
                    pass

    @socketio.on("command", namespace=NS)
    def command(data):
        with _lock:
            try:
                client = _clients.get(request.sid)
                if client is None or not isinstance(data, dict):
                    raise ValueError("Please reconnect to the lobby.")
                if client["userId"]:
                    # Socket events share their handshake request. Discard its
                    # cached session so sign-out/password reset revokes access.
                    request.environ.pop("cards.session", None)
                    user = session_user()
                    if not user or user.id != client["userId"]:
                        raise ValueError(
                            "Your account changed. Sign in again to rejoin this table."
                        )
                now = time.time()
                client["events"] = [t for t in client["events"] if now - t < 10]
                if len(client["events"]) >= 50:
                    raise ValueError("Please slow down and try again.")
                client["events"].append(now)
                kind = data.get("type")
                if kind == "create":
                    if client.get("token"):
                        try:
                            previous = get_table(client.get("code"))
                        except ValueError:
                            client["token"] = None
                        else:
                            if member_for(previous, client["token"]) is not None:
                                raise ValueError(
                                    "Leave your current lobby before creating another."
                                )
                            client["token"] = None
                    name = client["name"] or text(
                        data.get("name", "Host"), "your name", 20
                    )
                    default_difficulty = (
                        data.get("difficulty", "hard") if client["userId"] else "hard"
                    )
                    if default_difficulty not in ("hard", "harder", "hardest"):
                        raise ValueError("Choose a Hard strength from Options.")
                    # Expired snapshots contain credentials; remove them after their idle window.
                    EuchreTable.query.filter(
                        EuchreTable.updated_at
                        < datetime.utcnow() - timedelta(seconds=TTL_SECONDS)
                    ).delete()
                    for code in list(_tables):
                        if now - _tables[code]["touched"] > TTL_SECONDS:
                            _tables.pop(code, None)
                    if EuchreTable.query.count() >= 1000:
                        raise ValueError("All tables are busy. Please try again soon.")
                    code = "".join(
                        secrets.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789")
                        for _ in range(6)
                    )
                    while db.session.get(EuchreTable, code):
                        code = "".join(
                            secrets.choice("ABCDEFGHJKMNPQRSTUVWXYZ23456789")
                            for _ in range(6)
                        )
                    token = secrets.token_urlsafe(32)
                    table = dict(
                        code=code,
                        host=token,
                        status="waiting",
                        game=None,
                        participants=[],
                        unseated={},
                        seats=[
                            dict(
                                name=name,
                                icon=client["icon"],
                                token=token,
                                userId=client["userId"],
                                joined=0,
                                bot=False,
                            ),
                            None,
                            None,
                            None,
                        ],
                        teams=[
                            dict(
                                name=f"Team {i+1}",
                                named=False,
                                captain=token if i == 0 else None,
                            )
                            for i in range(2)
                        ],
                        revision=0,
                        touched=now,
                        difficulty=default_difficulty,
                        defaultDifficulty=default_difficulty,
                    )
                    _tables[code] = table
                    client.update(code=code, token=token)
                    changed(table)
                    return dict(ok=True, code=code, token=token)

                table = get_table(data.get("code", client.get("code")))
                if kind != "watch" and client.get("code") != table["code"]:
                    raise ValueError("Open this lobby before choosing a seat.")
                token = (
                    client.get("token") if client.get("code") == table["code"] else None
                )
                if kind == "watch":
                    candidate = data.get("token")
                    s = member_for(table, candidate)
                    if s is not None:
                        if s.get("userId") and s["userId"] != client["userId"]:
                            raise ValueError(
                                "Sign in to the account that joined this table."
                            )
                        token = candidate
                        _disconnections.pop(token, None)
                        s["bot"] = False
                        for p in table["participants"]:
                            if (
                                table["status"] == "playing"
                                and p["token"] == token
                                and not p.get("left")
                            ):
                                p["conceded"] = False
                    if client.get("token") and client.get("code") != table["code"]:
                        raise ValueError("Leave your current lobby first.")
                    if (
                        s is None
                        and not member_for(table, token)
                        and table["status"] != "closed"
                    ):
                        if len(table["unseated"]) >= 32:
                            raise ValueError("The lobby waiting room is full.")
                        token = secrets.token_urlsafe(32)
                        s = dict(
                            name=client["name"] or "Guest",
                            icon=client["icon"],
                            token=token,
                            userId=client["userId"],
                            bot=False,
                            joined=max((m["joined"] for m in members(table)), default=0)
                            + 1,
                            reserved=False,
                            named=bool(client["name"]),
                        )
                        table["unseated"][token] = s
                    client.update(code=table["code"], token=token)
                    captains(table)
                    migrate_host(table)
                    if s is not None:
                        changed(table)
                    else:
                        socketio.emit(
                            "state",
                            dict(
                                lobby=public(table, token), game=game_view(table, token)
                            ),
                            to=request.sid,
                            namespace=NS,
                        )
                    recover_disconnections(table)
                    return dict(ok=True, code=table["code"], token=token)
                index = seat_for(table, token)
                member = member_for(table, token)
                if kind == "join":
                    if table["status"] != "waiting":
                        raise ValueError("This game has already started.")
                    target = data.get("seat")
                    if type(target) is not int or target not in range(4):
                        raise ValueError("Choose an open seat.")
                    if table["seats"][target] and table["seats"][target].get("token"):
                        raise ValueError("That seat has already been taken.")
                    if (
                        index is None
                        and not (member or {}).get("reserved", False)
                        and len(reserved_members(table)) >= 4
                    ):
                        raise ValueError(
                            "This group is full. A player is choosing a seat."
                        )
                    if client["userId"] and any(
                        s.get("userId") == client["userId"] and s["token"] != token
                        for s in members(table)
                    ):
                        raise ValueError("You already have a seat at this table.")
                    old = member
                    name = client["name"] or (
                        text(data.get("name"), "your name", 20)
                        if data.get("name")
                        else (
                            old["name"]
                            if old and old.get("named", True)
                            else text("", "your name", 20)
                        )
                    )
                    if index is not None:
                        table["seats"][index] = None
                    token = token or secrets.token_urlsafe(32)
                    table["seats"][target] = dict(
                        name=name,
                        icon=client["icon"],
                        token=token,
                        userId=client["userId"],
                        joined=(
                            old["joined"]
                            if old and index is not None and index % 2 == target % 2
                            else max(
                                (s.get("joined", 0) for s in members(table)),
                                default=0,
                            )
                            + 1
                        ),
                        bot=False,
                    )
                    table["unseated"].pop(token, None)
                    client.update(code=table["code"], token=token)
                    captains(table)
                    migrate_host(table)
                    changed(table)
                    return dict(ok=True, code=table["code"], token=token)
                if member is None:
                    raise ValueError("Choose a seat in this lobby first.")
                is_host = table["host"] == token
                if kind == "unseat":
                    if table["status"] != "waiting" or index is None:
                        raise ValueError(
                            "You can leave your seat while waiting in the lobby."
                        )
                    table["unseated"][token] = table["seats"][index]
                    table["unseated"][token]["reserved"] = True
                    table["seats"][index] = None
                    captains(table)
                    migrate_host(table)
                elif kind == "rename":
                    if index is not None or client["name"]:
                        raise ValueError("Your name is already set at this table.")
                    member.update(
                        name=text(data.get("name"), "your name", 20), named=True
                    )
                elif kind == "name":
                    if index is None:
                        raise ValueError("Choose a team before naming it.")
                    side = index % 2
                    if (
                        table["status"] != "waiting"
                        or table["teams"][side]["captain"] != token
                    ):
                        raise ValueError(
                            "Only the first person on this team can name it in the lobby."
                        )
                    table["teams"][side].update(
                        name=text(data.get("name"), "a team name", 24), named=True
                    )
                elif kind == "start":
                    if not is_host or table["status"] != "waiting":
                        raise ValueError("Only the host can start the game.")
                    start_match(
                        table, data.get("difficulty", table["defaultDifficulty"])
                    )
                elif kind == "action":
                    g = table["game"]
                    if (
                        table["status"] != "playing"
                        or data.get("revision") != table["revision"]
                    ):
                        raise ValueError("The table changed. Please try again.")
                    action = data.get("action")
                    if g["phase"] == "round_complete":
                        if not is_host or action != dict(type="advance"):
                            raise ValueError(
                                "Waiting for the host to deal the next hand."
                            )
                    elif (
                        g["turn"] != index
                        or g["phase"] == "trick_complete"
                        or table["seats"][index].get("bot")
                    ):
                        raise ValueError("Wait for your turn.")
                    table["game"] = apply_action(g, action)
                elif kind == "rematch":
                    if not is_host or table["status"] != "finished":
                        raise ValueError(
                            "Waiting for the host to return the group to the lobby."
                        )
                    # Keep the same seats, invitations and team names across games.
                    table.update(status="waiting", game=None, participants=[])
                    for i, s in enumerate(table["seats"]):
                        if s and s.get("token") and not connected(s["token"]):
                            table["seats"][i] = None
                    captains(table)
                    migrate_host(table)
                elif kind == "play_again":
                    if not is_host or table["status"] != "finished":
                        raise ValueError(
                            "Only the host can start the next game after this one finishes."
                        )
                    start_match(table, table["difficulty"])
                elif kind == "leave":
                    if table["status"] == "playing" and index is not None:
                        s = table["seats"][index]
                        s.pop("token", None)
                        s.pop("userId", None)
                        s["bot"] = True
                        for p in table["participants"]:
                            if p["token"] == token:
                                p.update(conceded=True, left=True)
                    elif index is not None:
                        table["seats"][index] = None
                    else:
                        table["unseated"].pop(token, None)
                    for c in _clients.values():
                        if c.get("token") == token:
                            c["token"] = None
                    captains(table)
                    migrate_host(table)
                elif kind == "close":
                    if not is_host or table["status"] == "playing":
                        raise ValueError("Only the host can close a waiting lobby.")
                    table["status"] = "closed"
                    for c in _clients.values():
                        if c.get("code") == table["code"]:
                            c["token"] = None
                else:
                    raise ValueError("Unknown lobby action.")
                changed(table)
                return dict(ok=True)
            except ValueError as error:
                return dict(ok=False, error=str(error))
            except Exception:
                db.session.rollback()
                app.logger.exception("Euchre multiplayer command failed")
                return dict(
                    ok=False,
                    error="The table could not save that change. Please reconnect and try again.",
                )
