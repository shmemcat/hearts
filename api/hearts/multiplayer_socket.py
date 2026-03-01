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
from hearts.models import ActiveGame, DifficultyStats, GameResult, UserStats
from hearts.multiplayer_runner import MultiplayerRunner, SeatConfig
from hearts.multiplayer_game_ops import (
    GameOps,
    make_game_callbacks,
    advance_if_bot_turn,
)
from hearts.jwt_utils import get_current_user

_RECONNECT_TIMEOUT_SECONDS = 120
_IDLE_TIMEOUT_SECONDS = 600
_IDLE_WARNING_SECONDS = 540
_STALE_GAME_SECONDS = 30 * 60  # 30 minutes with no DB update → game is abandoned


def _get_user_from_query_token():
    """Try to authenticate via auth_token query param (JWT passed by the client)."""
    import os
    import jwt as pyjwt

    auth_token = (request.args.get("auth_token") or "").strip()
    if not auth_token:
        return None
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        return None
    try:
        payload = pyjwt.decode(auth_token, secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
        from hearts.models import User

        return User.query.get(int(user_id))
    except pyjwt.InvalidTokenError:
        return None


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

# game_id -> {seat_index -> eventlet.GreenThread} for idle kick timers
_idle_timers: Dict[str, Dict[int, Any]] = {}

# game_id -> {seat_index -> eventlet.GreenThread} for idle warning timers
_idle_warning_timers: Dict[str, Dict[int, Any]] = {}


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


def is_game_stale(row: ActiveGame) -> bool:
    """Check whether a game has had no activity for _STALE_GAME_SECONDS."""
    from datetime import datetime, timedelta

    threshold = datetime.utcnow() - timedelta(seconds=_STALE_GAME_SECONDS)
    last_activity = row.updated_at or row.created_at
    return last_activity is not None and last_activity < threshold


def cleanup_game_if_stale(game_id: str) -> bool:
    """If a single multiplayer game is stale, clean it up. Returns True if deleted."""
    row = ActiveGame.query.filter_by(game_id=game_id, is_multiplayer=True).first()
    if row is None:
        return False
    if not is_game_stale(row):
        return False
    _runners.pop(game_id, None)
    _cancel_all_idle_timers(game_id)
    db.session.delete(row)
    db.session.commit()
    return True


def cleanup_stale_multiplayer_games() -> int:
    """Delete multiplayer games that have been inactive for too long. Returns count deleted."""
    from datetime import datetime, timedelta

    threshold = datetime.utcnow() - timedelta(seconds=_STALE_GAME_SECONDS)
    stale_rows = ActiveGame.query.filter(
        ActiveGame.is_multiplayer == True,  # noqa: E712
        db.or_(
            db.and_(
                ActiveGame.updated_at != None, ActiveGame.updated_at < threshold
            ),  # noqa: E711
            db.and_(
                ActiveGame.updated_at == None, ActiveGame.created_at < threshold
            ),  # noqa: E711
        ),
    ).all()
    count = 0
    for row in stale_rows:
        _runners.pop(row.game_id, None)
        _cancel_all_idle_timers(row.game_id)
        db.session.delete(row)
        count += 1
    if count:
        db.session.commit()
    return count


def _save_to_db(
    game_id: str, runner: MultiplayerRunner, lobby_code: Optional[str] = None
) -> None:
    from datetime import datetime

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
        row.updated_at = datetime.utcnow()
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


def _cancel_idle_timer(game_id: str, seat_idx: int) -> None:
    """Cancel both warning and kick timers for a single seat."""
    warn_timers = _idle_warning_timers.get(game_id)
    if warn_timers:
        t = warn_timers.pop(seat_idx, None)
        if t is not None:
            t.cancel()
    kick_timers = _idle_timers.get(game_id)
    if kick_timers:
        t = kick_timers.pop(seat_idx, None)
        if t is not None:
            t.cancel()


def _cancel_all_idle_timers(game_id: str) -> None:
    """Cancel all idle timers for a game."""
    for store in (_idle_warning_timers, _idle_timers):
        timers = store.pop(game_id, None)
        if timers:
            for t in timers.values():
                t.cancel()


def _start_idle_timer(game_id: str, seat_idx: int, socketio, app) -> None:
    """Start the 9-min warning + 10-min kick timers for one seat."""
    _cancel_idle_timer(game_id, seat_idx)

    runner = _get_runner(game_id)
    if runner is None:
        return
    seat = runner.seats[seat_idx]
    if not seat.is_human or seat.conceded:
        return

    token = seat.player_token

    def _on_idle_warning():
        try:
            with app.app_context():
                if not token:
                    return
                sid = _token_to_sid.get(token)
                if sid:
                    socketio.emit("idle_warning", {}, to=sid, namespace="/multi")
        except Exception:
            logger.exception(
                "Error in idle warning callback: game=%s seat=%d",
                game_id,
                seat_idx,
            )

    def _on_idle_timeout():
        try:
            with app.app_context():
                _idle_timers.get(game_id, {}).pop(seat_idx, None)
                _idle_warning_timers.get(game_id, {}).pop(seat_idx, None)
                r = _get_runner(game_id)
                if r is None:
                    return
                s = r.seats[seat_idx]
                if not s.is_human or s.conceded:
                    return

                result = r.concede_player(seat_idx)
                socketio.emit(
                    "player_conceded",
                    {
                        "seat_index": seat_idx,
                        "name": r.seats[seat_idx].name,
                        "reason": "idle",
                    },
                    room=_room(game_id),
                    namespace="/multi",
                )

                # Move the idle player to spectator if still connected
                if token:
                    sid = _token_to_sid.pop(token, None)
                    if sid:
                        _sid_to_game[sid] = {
                            "game_id": game_id,
                            "spectator": True,
                        }
                        specs = _spectator_sids.setdefault(game_id, set())
                        specs.add(sid)

                if result == "terminated":
                    socketio.emit(
                        "game_terminated",
                        {},
                        room=_room(game_id),
                        namespace="/multi",
                    )
                    _cancel_all_idle_timers(game_id)
                    _on_game_complete(game_id, r, socketio)
                else:
                    _emit_state_to_all(game_id, r, socketio)
                    _save_to_db(game_id, r)

                    advance_if_bot_turn(game_id, r, _build_ops(socketio, app))
        except Exception:
            logger.exception(
                "Error in idle timeout callback: game=%s seat=%d",
                game_id,
                seat_idx,
            )

    warn_store = _idle_warning_timers.setdefault(game_id, {})
    warn_store[seat_idx] = eventlet.spawn_after(_IDLE_WARNING_SECONDS, _on_idle_warning)

    kick_store = _idle_timers.setdefault(game_id, {})
    kick_store[seat_idx] = eventlet.spawn_after(_IDLE_TIMEOUT_SECONDS, _on_idle_timeout)


def _start_idle_timers_for_actionable_seats(
    game_id: str, runner: MultiplayerRunner, socketio, app
) -> None:
    """Start idle timers only for human seats that currently need to act."""
    if runner.state.game_over:
        _cancel_all_idle_timers(game_id)
        return

    phase = runner.state.phase.value

    if phase == "passing":
        for i in range(4):
            if runner.is_active_human(i) and i not in runner.pending_passes:
                existing = _idle_timers.get(game_id, {}).get(i)
                if existing is None:
                    _start_idle_timer(game_id, i, socketio, app)
            else:
                _cancel_idle_timer(game_id, i)

    elif phase == "playing":
        whose_turn = runner.state.whose_turn
        for i in range(4):
            if i == whose_turn and runner.is_active_human(i):
                existing = _idle_timers.get(game_id, {}).get(i)
                if existing is None:
                    _start_idle_timer(game_id, i, socketio, app)
            else:
                _cancel_idle_timer(game_id, i)


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
    _cancel_all_idle_timers(game_id)
    auth_map = _game_auth.get(game_id, {})
    scores = runner.state.scores
    min_score = min(scores)
    winners = [i for i, s in enumerate(scores) if s == min_score]

    for seat_idx, user_id in auth_map.items():
        seat = runner.seats[seat_idx]
        if seat.conceded:
            continue
        player_score = int(scores[seat_idx])
        won = seat_idx in winners and len(winners) == 1

        # Per-category stats (multiplayer)
        ds = DifficultyStats.query.filter_by(
            user_id=user_id, category="multiplayer"
        ).first()
        if not ds:
            ds = DifficultyStats(user_id=user_id, category="multiplayer")
            db.session.add(ds)
        ds.games_played += 1
        if won:
            ds.games_won += 1
            ds.current_win_streak += 1
            if ds.current_win_streak > ds.max_win_streak:
                ds.max_win_streak = ds.current_win_streak
        else:
            ds.current_win_streak = 0
        ds.total_points += player_score
        if ds.best_score is None or player_score < ds.best_score:
            ds.best_score = player_score
        if ds.worst_score is None or player_score > ds.worst_score:
            ds.worst_score = player_score

        # Global user stats
        us = UserStats.query.filter_by(user_id=user_id).first()
        if not us:
            us = UserStats(user_id=user_id)
            db.session.add(us)
        us.games_played += 1
        if won:
            us.games_won += 1
            us.current_win_streak += 1
            if us.current_win_streak > us.max_win_streak:
                us.max_win_streak = us.current_win_streak
        else:
            us.current_win_streak = 0
        us.total_points += player_score
        if us.best_score is None or player_score < us.best_score:
            us.best_score = player_score
        if us.worst_score is None or player_score > us.worst_score:
            us.worst_score = player_score

        # Game result log (for leaderboard)
        db.session.add(
            GameResult(
                user_id=user_id,
                difficulty="multiplayer",
                won=won,
            )
        )

    db.session.commit()

    active = ActiveGame.query.filter_by(game_id=game_id).first()
    if active and active.lobby_code:
        lobby = get_lobby(active.lobby_code)
        if lobby:
            lobby.status = "finished"

    _delete_game(game_id)
    _game_auth.pop(game_id, None)


def _build_ops(socketio, app) -> GameOps:
    return GameOps(
        socketio=socketio,
        app=app,
        room=_room,
        emit_state_to_all=_emit_state_to_all,
        save_to_db=_save_to_db,
        cancel_all_idle_timers=_cancel_all_idle_timers,
        on_game_complete=_on_game_complete,
        start_idle_timers=_start_idle_timers_for_actionable_seats,
    )


def concede_multiplayer_by_token(
    game_id: str, player_token: str, socketio, app
) -> Optional[str]:
    """Concede a multiplayer player by their player_token (for REST API use).

    Returns 'conceded', 'terminated', or None if the game/seat wasn't found.
    """
    runner = _get_runner(game_id)
    if runner is None:
        return None

    seat_idx = _find_seat_by_token(runner, player_token)
    if seat_idx is None:
        return None
    seat = runner.seats[seat_idx]
    if not seat.is_human or seat.conceded:
        return None

    _cancel_idle_timer(game_id, seat_idx)

    try:
        result = runner.concede_player(seat_idx)
    except ValueError:
        return None

    socketio.emit(
        "player_conceded",
        {
            "seat_index": seat_idx,
            "name": runner.seats[seat_idx].name,
            "reason": "conceded",
        },
        room=_room(game_id),
        namespace="/multi",
    )

    # Move to spectator if connected
    sid = _token_to_sid.pop(player_token, None)
    if sid:
        _sid_to_game[sid] = {"game_id": game_id, "spectator": True}
        specs = _spectator_sids.setdefault(game_id, set())
        specs.add(sid)

    if result == "terminated":
        socketio.emit("game_terminated", {}, room=_room(game_id), namespace="/multi")
        _cancel_all_idle_timers(game_id)
        _on_game_complete(game_id, runner, socketio)
    else:
        _emit_state_to_all(game_id, runner, socketio)
        _save_to_db(game_id, runner)

        advance_if_bot_turn(game_id, runner, _build_ops(socketio, app))

    return result


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
                icon=sd.get("icon", "robot" if sd["is_ai"] else "user"),
            )
        )

    runner = MultiplayerRunner.new_game(seats, difficulty=difficulty)
    _runners[game_id] = runner
    _save_to_db(game_id, runner, lobby_code=lobby_code)

    app = current_app._get_current_object()

    advance_if_bot_turn(game_id, runner, _build_ops(socketio, app))

    return runner


_unstick_in_progress: Set[str] = set()


def _try_unstick_game(game_id: str, runner: MultiplayerRunner, socketio) -> None:
    """If a bot's turn is stuck (playing phase) or all human passes are in
    but passes weren't applied, try to advance the game.  Called from
    request_state as a lightweight recovery mechanism.
    """
    if runner.state.game_over:
        return
    if game_id in _unstick_in_progress:
        return

    phase = runner.state.phase.value
    needs_advance = False

    if phase == "playing" and not runner.is_active_human(runner.state.whose_turn):
        needs_advance = True
    elif phase == "passing":
        humans = [i for i in range(4) if runner.is_active_human(i)]
        if humans and all(i in runner.pending_passes for i in humans):
            needs_advance = True

    if not needs_advance:
        return

    _unstick_in_progress.add(game_id)
    try:
        app = current_app._get_current_object()

        if phase == "passing":
            runner.apply_all_passes()
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

        advance_if_bot_turn(game_id, runner, _build_ops(socketio, app))
    except Exception:
        logger.exception("Error in _try_unstick_game: game=%s", game_id)
    finally:
        _unstick_in_progress.discard(game_id)


def register_multiplayer_socket(socketio):

    @socketio.on("connect", namespace="/multi")
    def on_connect():
        try:
            game_id = (request.args.get("game_id") or "").strip()
            player_token = (request.args.get("player_token") or "").strip() or None

            if not game_id:
                return False

            runner = _get_runner(game_id)
            if runner is None:
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
                    if user is None:
                        user = _get_user_from_query_token()
                    if user:
                        auth = _game_auth.setdefault(game_id, {})
                        auth[seat_idx] = user.id

                    # Restart idle timer if this seat has an actionable move
                    if runner.is_active_human(seat_idx):
                        app = current_app._get_current_object()
                        _start_idle_timers_for_actionable_seats(
                            game_id, runner, socketio, app
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
            emit("state", runner.get_state_for_spectator(), namespace="/multi")
        except Exception:
            logger.exception("on_connect error")
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

        _try_unstick_game(game_id, runner, socketio)

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

        # Cancel idle timer -- disconnect timer takes over
        _cancel_idle_timer(game_id, seat_idx)

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
                    {
                        "seat_index": seat_idx,
                        "name": r.seats[seat_idx].name,
                        "reason": "disconnected",
                    },
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
                    _cancel_all_idle_timers(game_id)
                    _on_game_complete(game_id, r, socketio)
                else:
                    _emit_state_to_all(game_id, r, socketio)
                    _save_to_db(game_id, r)

                    advance_if_bot_turn(game_id, r, _build_ops(socketio, app))

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

        _cancel_idle_timer(game_id, seat_idx)
        app = current_app._get_current_object()

        if result == "waiting":
            emit("pass_received", {"seat_index": seat_idx}, namespace="/multi")
            _save_to_db(game_id, runner)
        elif result == "applied":
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

            advance_if_bot_turn(game_id, runner, _build_ops(socketio, app))

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

        _cancel_idle_timer(game_id, seat_idx)
        app = current_app._get_current_object()

        on_play, on_trick_complete, on_done = make_game_callbacks(
            game_id, runner, _build_ops(socketio, app)
        )

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

        _cancel_idle_timer(game_id, seat_idx)

        try:
            result = runner.concede_player(seat_idx)
        except ValueError as e:
            emit("error", {"message": str(e)}, namespace="/multi")
            return {"status": "error"}

        socketio.emit(
            "player_conceded",
            {
                "seat_index": seat_idx,
                "name": runner.seats[seat_idx].name,
                "reason": "conceded",
            },
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
            _cancel_all_idle_timers(game_id)
            _on_game_complete(game_id, runner, socketio)
        else:
            app = current_app._get_current_object()
            _emit_state_to_all(game_id, runner, socketio)
            _save_to_db(game_id, runner)

            advance_if_bot_turn(game_id, runner, _build_ops(socketio, app))

        return {"status": result}
