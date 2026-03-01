"""
Reusable game-lifecycle helpers for multiplayer.

`GameOps` bundles the socket/DB helpers that live in multiplayer_socket so
this module stays free of circular imports.  Call sites build a GameOps once
and pass it through.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from hearts.multiplayer_runner import MultiplayerRunner


@dataclass(frozen=True)
class GameOps:
    """Dependency bundle for socket / DB / timer operations."""

    socketio: Any
    app: Any
    room: Callable[[str], str]
    emit_state_to_all: Callable  # (game_id, runner, socketio) -> None
    save_to_db: Callable  # (game_id, runner, **kw) -> None
    cancel_all_idle_timers: Callable  # (game_id) -> None
    on_game_complete: Callable  # (game_id, runner, socketio) -> None
    start_idle_timers: Callable  # (game_id, runner, socketio, app) -> None


def make_game_callbacks(game_id: str, runner: MultiplayerRunner, ops: GameOps):
    """Create the standard on_play / on_trick_complete / on_done callbacks
    used when advancing bot turns.  Centralises the round-transition logic
    so that no-pass rounds where a bot leads are handled correctly.
    """

    def on_play(ev):
        ops.socketio.emit("play", ev, room=ops.room(game_id), namespace="/multi")

    def on_trick_complete():
        ops.socketio.emit(
            "trick_complete", {}, room=ops.room(game_id), namespace="/multi"
        )

    def on_done(d):
        ops.emit_state_to_all(game_id, runner, ops.socketio)
        if runner.state.game_over:
            ops.socketio.emit(
                "game_over",
                runner.get_state_for_spectator(),
                room=ops.room(game_id),
                namespace="/multi",
            )
            ops.cancel_all_idle_timers(game_id)
            ops.on_game_complete(game_id, runner, ops.socketio)
        else:
            ops.save_to_db(game_id, runner)
            if (
                d.get("round_just_ended")
                and runner.state.phase.value == "playing"
                and not runner.state.game_over
                and not runner.is_active_human(runner.state.whose_turn)
            ):
                runner.advance_to_human_turn(
                    on_play=on_play,
                    on_trick_complete=on_trick_complete,
                    on_done=on_done,
                )
            else:
                ops.start_idle_timers(game_id, runner, ops.socketio, ops.app)

    return on_play, on_trick_complete, on_done


def advance_if_bot_turn(game_id: str, runner: MultiplayerRunner, ops: GameOps) -> None:
    """If the current turn belongs to a bot, advance to the next human turn.
    Otherwise just start idle timers for the actionable seat.
    """
    if (
        runner.state.phase.value == "playing"
        and not runner.state.game_over
        and not runner.is_active_human(runner.state.whose_turn)
    ):
        on_play, on_trick_complete, on_done = make_game_callbacks(game_id, runner, ops)
        runner.advance_to_human_turn(
            on_play=on_play,
            on_trick_complete=on_trick_complete,
            on_done=on_done,
        )
    else:
        ops.start_idle_timers(game_id, runner, ops.socketio, ops.app)
