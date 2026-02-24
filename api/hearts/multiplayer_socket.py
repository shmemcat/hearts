"""
WebSocket handlers for the /multi namespace (multiplayer gameplay).

Each player connects with game_id + player_token. Spectators connect with
game_id only (no token). State is emitted per-player (each sees only their
own hand). Play/trick events are broadcast to the entire room.
"""

import logging
import eventlet
from typing import Any, Dict, Optional, Set, Tuple

from flask import current_app, request
from flask_socketio import emit, join_room

logger = logging.getLogger(__name__)

from hearts.extensions import db
from hearts.game.card import Card
from hearts.lobby import get_lobby
from hearts.models import ActiveGame, DifficultyStats
from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig
from hearts.jwt_utils import get_current_user

_RECONNECT_TIMEOUT_SECONDS = 120

# game_id -> MultiplayerRunner
_runners: Dict[str, MultiplayerRunner] = {}

# SID -> {game_id, seat_index} or {game_id, spectator: True}
_sid_to_game: Dict[str, Dict[str, Any]] = {}

# player_token -> SID (for targeted emits)
_token_to_sid: Dict[str, str] = {}

# game_id -> set of spectator SIDs
_spectator_sids: Dict[str, Set[str]] = {}

# player_token -> eventlet.GreenThread for disconnect timers
_disconnect_timers: Dict[str, Any] = {}

# game_id -> {seat_index -> jwt_user_id} — tracked at connect time
_game_auth: Dict[str, Dict[int, int]] = {}


def _get_runner(game_id: str) -> Optional[MultiplayerRunner]:
    runner = _runners.get(game_id)
    if runner is not None:
        return runner
    row = ActiveGame.query.filter_by(game_id=game_id, is_multiplayer=True).first()
    if row is None:
        return None
    runner = MultiplayerRunner.from_json(row.state_json)
    _runners[game_id] = runner
    return runner


def _save_to_db(
    game_id: str, runner: MultiplayerRunner, lobby_code: Optional[str] = None
) -> None:
    row = ActiveGame.query.filter_by(game_id=game_id).first()
    if row is None:
        row = ActiveGame(
            game_id=game_id,
            difficulty=runner.difficulty,
            state_json=runner.to_json(),
            is_multiplayer=True,
            lobby_code=lobby_code,
        )
        db.session.add(row)
    else:
        row.state_json = runner.to_json()
    db.session.commit()


def _delete_game(game_id: str) -> None:
    _runners.pop(game_id, None)
    ActiveGame.query.filter_by(game_id=game_id).delete()
    db.session.commit()


def _room(game_id: str) -> str:
    return f"game:{game_id}"


def _find_seat_by_token(runner: MultiplayerRunner, token: str) -> Optional[int]:
    for i, seat in enumerate(runner.seats):
        if seat.player_token == token:
            return i
    return None


def _emit_state_to_all(game_id: str, runner: MultiplayerRunner, socketio) -> None:
    """Send personalized state to each connected player and public state to spectators."""
    for token, sid in list(_token_to_sid.items()):
        info = _sid_to_game.get(sid)
        if info is None or info.get("game_id") != game_id:
            continue
        seat = info.get("seat_index")
        if seat is not None:
            socketio.emit(
                "state",
                runner.get_state_for_player(seat),
                to=sid,
                namespace="/multi",
            )

    spectators = _spectator_sids.get(game_id, set())
    if spectators:
        spec_state = runner.get_state_for_spectator()
        for sid in list(spectators):
            socketio.emit("state", spec_state, to=sid, namespace="/multi")


def _on_game_complete(game_id: str, runner: MultiplayerRunner, socketio) -> None:
    """Record stats for authenticated players and clean up."""
    auth_map = _game_auth.get(game_id, {})
    scores = runner.state.scores
    min_score = min(scores)
    winners = [i for i, s in enumerate(scores) if s == min_score]

    for seat_idx, user_id in auth_map.items():
        seat = runner.seats[seat_idx]
        if seat.conceded:
            continue
        stats = DifficultyStats.query.filter_by(
            user_id=user_id, category="multiplayer"
        ).first()
        if not stats:
            stats = DifficultyStats(user_id=user_id, category="multiplayer")
            db.session.add(stats)
        stats.games_played += 1
        player_score = int(scores[seat_idx])
        if seat_idx in winners and len(winners) == 1:
            stats.games_won += 1
        stats.total_points += player_score
        if stats.best_score is None or player_score < stats.best_score:
            stats.best_score = player_score
        if stats.worst_score is None or player_score > stats.worst_score:
            stats.worst_score = player_score

    db.session.commit()

    active = ActiveGame.query.filter_by(game_id=game_id).first()
    if active and active.lobby_code:
        lobby = get_lobby(active.lobby_code)
        if lobby:
            lobby.status = "finished"

    _delete_game(game_id)
    _game_auth.pop(game_id, None)


def create_multiplayer_game(
    game_id: str,
    lobby_code: str,
    difficulty: str,
    seats_data: list,
    socketio,
) -> MultiplayerRunner:
    """Called by lobby_socket when the host starts the game.

    seats_data: list of 4 dicts with {name, is_ai, player_token}.
    """
    seats = []
    for sd in seats_data:
        seats.append(
            SeatConfig(
                name=sd["name"],
                is_human=not sd["is_ai"],
                player_token=sd.get("player_token"),
            )
        )

    runner = MultiplayerRunner.new_game(seats, difficulty=difficulty)
    _runners[game_id] = runner
    _save_to_db(game_id, runner, lobby_code=lobby_code)
    logger.info(
        "[multi] game created: game_id=%s, runners_count=%d", game_id, len(_runners)
    )

    # If AI has the first turn after a no-pass round, auto-advance
    if runner.state.phase.value == "playing" and not runner._is_active_human(
        runner.state.whose_turn
    ):

        def on_play(ev):
            socketio.emit("play", ev, room=_room(game_id), namespace="/multi")

        def on_trick_complete():
            socketio.emit("trick_complete", {}, room=_room(game_id), namespace="/multi")

        def on_done(info):
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

        runner.advance_to_human_turn(
            on_play=on_play, on_trick_complete=on_trick_complete, on_done=on_done
        )

    return runner


def register_multiplayer_socket(socketio):

    @socketio.on("connect", namespace="/multi")
    def on_connect():
        try:
            game_id = (request.args.get("game_id") or "").strip()
            player_token = (request.args.get("player_token") or "").strip() or None

            if not game_id:
                logger.warning(
                    "[multi] connect rejected: empty game_id, args=%s",
                    dict(request.args),
                )
                return False

            runner = _get_runner(game_id)
            if runner is None:
                logger.warning(
                    "[multi] connect rejected: runner not found for game_id=%s, in_memory_keys=%s",
                    game_id,
                    list(_runners.keys())[:10],
                )
                return False

            join_room(_room(game_id))

            if player_token:
                seat_idx = _find_seat_by_token(runner, player_token)
                if seat_idx is not None:
                    timer = _disconnect_timers.pop(player_token, None)
                    if timer is not None:
                        timer.cancel()

                    _sid_to_game[request.sid] = {
                        "game_id": game_id,
                        "seat_index": seat_idx,
                    }
                    _token_to_sid[player_token] = request.sid

                    user = get_current_user()
                    if user:
                        auth = _game_auth.setdefault(game_id, {})
                        auth[seat_idx] = user.id

                    logger.info(
                        "[multi] player connected: game=%s seat=%d", game_id, seat_idx
                    )
                    emit(
                        "state",
                        runner.get_state_for_player(seat_idx),
                        namespace="/multi",
                    )
                    return

            _sid_to_game[request.sid] = {"game_id": game_id, "spectator": True}
            specs = _spectator_sids.setdefault(game_id, set())
            specs.add(request.sid)
            logger.info("[multi] spectator connected: game=%s", game_id)
            emit("state", runner.get_state_for_spectator(), namespace="/multi")
        except Exception:
            logger.exception("[multi] on_connect crashed")
            return False

    @socketio.on("request_state", namespace="/multi")
    def on_request_state():
        info = _sid_to_game.get(request.sid)
        if not info:
            return
        game_id = info["game_id"]
        runner = _get_runner(game_id)
        if runner is None:
            return
        if info.get("spectator"):
            emit("state", runner.get_state_for_spectator(), namespace="/multi")
        else:
            seat = info.get("seat_index")
            if seat is not None:
                emit("state", runner.get_state_for_player(seat), namespace="/multi")

    @socketio.on("disconnect", namespace="/multi")
    def on_disconnect():
        info = _sid_to_game.pop(request.sid, None)
        if info is None:
            return

        game_id = info["game_id"]

        if info.get("spectator"):
            specs = _spectator_sids.get(game_id, set())
            specs.discard(request.sid)
            return

        seat_idx = info.get("seat_index")
        if seat_idx is None:
            return

        runner = _get_runner(game_id)
        if runner is None:
            return

        seat = runner.seats[seat_idx]
        if not seat.is_human or seat.conceded:
            return

        token = seat.player_token

        # Clean up token -> sid mapping
        if token and _token_to_sid.get(token) == request.sid:
            _token_to_sid.pop(token, None)

        app = current_app._get_current_object()

        def _on_reconnect_timeout():
            with app.app_context():
                _disconnect_timers.pop(token, None)
                r = _get_runner(game_id)
                if r is None:
                    return
                s = r.seats[seat_idx]
                if not s.is_human or s.conceded:
                    return
                if token in _token_to_sid:
                    return

                result = r.concede_player(seat_idx)
                socketio.emit(
                    "player_conceded",
                    {"seat_index": seat_idx, "name": r.seats[seat_idx].name},
                    room=_room(game_id),
                    namespace="/multi",
                )
                if result == "terminated":
                    socketio.emit(
                        "game_terminated",
                        {},
                        room=_room(game_id),
                        namespace="/multi",
                    )
                    _on_game_complete(game_id, r, socketio)
                else:
                    _emit_state_to_all(game_id, r, socketio)
                    _save_to_db(game_id, r)

                    if r.state.phase.value == "playing" and not r.state.game_over:
                        if not r._is_active_human(r.state.whose_turn):

                            def on_play(ev):
                                socketio.emit(
                                    "play",
                                    ev,
                                    room=_room(game_id),
                                    namespace="/multi",
                                )

                            def on_trick_complete():
                                socketio.emit(
                                    "trick_complete",
                                    {},
                                    room=_room(game_id),
                                    namespace="/multi",
                                )

                            def on_done(d):
                                _emit_state_to_all(game_id, r, socketio)
                                if r.state.game_over:
                                    socketio.emit(
                                        "game_over",
                                        r.get_state_for_spectator(),
                                        room=_room(game_id),
                                        namespace="/multi",
                                    )
                                    _on_game_complete(game_id, r, socketio)
                                else:
                                    _save_to_db(game_id, r)

                            r.advance_to_human_turn(
                                on_play=on_play,
                                on_trick_complete=on_trick_complete,
                                on_done=on_done,
                            )

        if token:
            timer = eventlet.spawn_after(
                _RECONNECT_TIMEOUT_SECONDS, _on_reconnect_timeout
            )
            _disconnect_timers[token] = timer

    @socketio.on("pass", namespace="/multi")
    def on_pass(data):
        info = _sid_to_game.get(request.sid)
        if not info or info.get("spectator"):
            emit("error", {"message": "Not a player"}, namespace="/multi")
            return

        game_id = info["game_id"]
        seat_idx = info["seat_index"]
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/multi")
            return

        raw = data.get("cards") if isinstance(data, dict) else None
        if not isinstance(raw, list) or len(raw) != 3:
            emit(
                "error",
                {"message": "Must provide exactly 3 card codes"},
                namespace="/multi",
            )
            return

        try:
            cards = [Card.from_code(str(c)) for c in raw]
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")
            return

        try:
            result = runner.submit_pass(seat_idx, cards)
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")
            return

        if result == "waiting":
            emit("pass_received", {"seat_index": seat_idx}, namespace="/multi")
            _save_to_db(game_id, runner)
        elif result == "applied":
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

            # If AI leads first after pass, advance
            if (
                runner.state.phase.value == "playing"
                and not runner.state.game_over
                and not runner._is_active_human(runner.state.whose_turn)
            ):

                def on_play(ev):
                    socketio.emit("play", ev, room=_room(game_id), namespace="/multi")

                def on_trick_complete():
                    socketio.emit(
                        "trick_complete", {}, room=_room(game_id), namespace="/multi"
                    )

                def on_done(d):
                    _emit_state_to_all(game_id, runner, socketio)
                    _save_to_db(game_id, runner)

                runner.advance_to_human_turn(
                    on_play=on_play,
                    on_trick_complete=on_trick_complete,
                    on_done=on_done,
                )

    @socketio.on("play", namespace="/multi")
    def on_play_message(data):
        info = _sid_to_game.get(request.sid)
        if not info or info.get("spectator"):
            emit("error", {"message": "Not a player"}, namespace="/multi")
            return

        game_id = info["game_id"]
        seat_idx = info["seat_index"]
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/multi")
            return

        raw = data.get("card") if isinstance(data, dict) else None
        if raw is None:
            emit("error", {"message": "Must provide a 'card' code"}, namespace="/multi")
            return

        try:
            card = Card.from_code(str(raw))
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")
            return

        def on_play(ev):
            socketio.emit("play", ev, room=_room(game_id), namespace="/multi")

        def on_trick_complete():
            socketio.emit("trick_complete", {}, room=_room(game_id), namespace="/multi")

        def on_done(d):
            _emit_state_to_all(game_id, runner, socketio)
            if runner.state.game_over:
                socketio.emit(
                    "game_over",
                    runner.get_state_for_spectator(),
                    room=_room(game_id),
                    namespace="/multi",
                )
                _on_game_complete(game_id, runner, socketio)
            else:
                _save_to_db(game_id, runner)

        try:
            runner.submit_play(
                seat_idx,
                card,
                on_play=on_play,
                on_trick_complete=on_trick_complete,
                on_done=on_done,
            )
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")

    @socketio.on("concede", namespace="/multi")
    def on_concede():
        info = _sid_to_game.get(request.sid)
        if not info or info.get("spectator"):
            emit("error", {"message": "Not a player"}, namespace="/multi")
            return {"status": "error"}

        game_id = info["game_id"]
        seat_idx = info["seat_index"]
        runner = _get_runner(game_id)
        if runner is None:
            emit("error", {"message": "Game not found"}, namespace="/multi")
            return {"status": "error"}

        try:
            result = runner.concede_player(seat_idx)
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")
            return {"status": "error"}

        socketio.emit(
            "player_conceded",
            {"seat_index": seat_idx, "name": runner.seats[seat_idx].name},
            room=_room(game_id),
            namespace="/multi",
        )

        # Move this player to spectator
        _sid_to_game[request.sid] = {"game_id": game_id, "spectator": True}
        specs = _spectator_sids.setdefault(game_id, set())
        specs.add(request.sid)
        token = runner.seats[seat_idx].player_token
        if token:
            _token_to_sid.pop(token, None)

        if result == "terminated":
            socketio.emit(
                "game_terminated", {}, room=_room(game_id), namespace="/multi"
            )
            _on_game_complete(game_id, runner, socketio)
        else:
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

            # If the conceded player was the current turn, run AI
            if (
                runner.state.phase.value == "playing"
                and not runner.state.game_over
                and not runner._is_active_human(runner.state.whose_turn)
            ):

                def on_play(ev):
                    socketio.emit("play", ev, room=_room(game_id), namespace="/multi")

                def on_trick_complete():
                    socketio.emit(
                        "trick_complete", {}, room=_room(game_id), namespace="/multi"
                    )

                def on_done(d):
                    _emit_state_to_all(game_id, runner, socketio)
                    if runner.state.game_over:
                        socketio.emit(
                            "game_over",
                            runner.get_state_for_spectator(),
                            room=_room(game_id),
                            namespace="/multi",
                        )
                        _on_game_complete(game_id, runner, socketio)
                    else:
                        _save_to_db(game_id, runner)

                runner.advance_to_human_turn(
                    on_play=on_play,
                    on_trick_complete=on_trick_complete,
                    on_done=on_done,
                )

        return {"status": result}
