"""
Multiplayer game runner: supports multiple human players at arbitrary seats.

Wraps the same GameState / transitions / rules used by single-player. The key
differences from GameRunner:
  - Any seat can be human or AI (not just seat 0).
  - Pass collection waits for all human players before applying.
  - State views are per-player (each player only sees their own hand).
  - Players can concede individually (seat converts to AI).
"""

import json
import random
from typing import Any, Callable, Dict, List, Optional

from hearts.game.card import Card, Suit, deck_52, shuffle_deck, deal_into_4_hands
from hearts.game.rules import get_legal_plays, is_valid_pass
from hearts.game.state import GameState, Phase, PassDirection
from hearts.game.transitions import (
    apply_passes,
    apply_play,
    apply_round_scoring,
    deal_new_round,
    _is_first_lead,
    _is_first_trick_of_round,
)
from hearts.ai.base import PassStrategy, PlayStrategy
from hearts.ai.factory import create_strategies


def _round_complete(state: GameState) -> bool:
    return sum(len(state.hands[i]) for i in range(4)) == 0


class SeatConfig:
    __slots__ = ("name", "is_human", "player_token", "conceded", "icon")

    def __init__(
        self,
        name: str,
        is_human: bool = False,
        player_token: Optional[str] = None,
        conceded: bool = False,
        icon: str = "user",
    ):
        self.name = name
        self.is_human = is_human
        self.player_token = player_token
        self.conceded = conceded
        self.icon = icon

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "is_human": self.is_human,
            "player_token": self.player_token,
            "conceded": self.conceded,
            "icon": self.icon,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "SeatConfig":
        return cls(
            name=d["name"],
            is_human=d.get("is_human", False),
            player_token=d.get("player_token"),
            conceded=d.get("conceded", False),
            icon=d.get("icon", "user"),
        )


class MultiplayerRunner:

    def __init__(
        self,
        state: GameState,
        pass_strategy: PassStrategy,
        play_strategy: PlayStrategy,
        seats: List[SeatConfig],
        rng: Optional[random.Random] = None,
        difficulty: str = "easy",
    ) -> None:
        self._state = state
        self._pass_strategy = pass_strategy
        self._play_strategy = play_strategy
        self._seats = seats
        self._rng = rng or random.Random()
        self._difficulty = difficulty
        self._pending_passes: Dict[int, List[Card]] = {}
        self._last_play_events: List[Dict[str, Any]] = []
        self._last_round_ended: bool = False

    @property
    def state(self) -> GameState:
        return self._state

    @property
    def seats(self) -> List[SeatConfig]:
        return self._seats

    @property
    def difficulty(self) -> str:
        return self._difficulty

    @classmethod
    def new_game(
        cls,
        seats: List[SeatConfig],
        difficulty: str = "easy",
        rng: Optional[random.Random] = None,
    ) -> "MultiplayerRunner":
        rng = rng or random.Random()
        deck = shuffle_deck(deck_52(), rng=rng)
        hands = deal_into_4_hands(deck)
        state = deal_new_round((0, 0, 0, 0), 1, hands)
        pass_strategy, play_strategy = create_strategies(difficulty, rng=rng)
        return cls(
            state, pass_strategy, play_strategy, seats, rng=rng, difficulty=difficulty
        )

    def _is_active_human(self, seat_index: int) -> bool:
        s = self._seats[seat_index]
        return s.is_human and not s.conceded

    def _all_humans_conceded(self) -> bool:
        return not any(self._is_active_human(i) for i in range(4))

    # ── Pass phase ──────────────────────────────────────────────────────

    def submit_pass(self, seat_index: int, cards: List[Card]) -> str:
        """Submit a human's pass. Returns 'waiting' or 'applied'."""
        if self._state.phase != Phase.PASSING:
            raise ValueError("Not in passing phase")
        if not self._is_active_human(seat_index):
            raise ValueError("Not an active human seat")
        hand = self._state.hand(seat_index)
        if not is_valid_pass(hand, cards):
            raise ValueError("Invalid pass: must select exactly 3 cards from your hand")
        if seat_index in self._pending_passes:
            raise ValueError("Pass already submitted")

        self._pending_passes[seat_index] = cards

        humans_needing_pass = [i for i in range(4) if self._is_active_human(i)]
        if all(i in self._pending_passes for i in humans_needing_pass):
            self._apply_all_passes()
            return "applied"
        return "waiting"

    def _apply_all_passes(self) -> None:
        passes: List[List[Card]] = [[] for _ in range(4)]
        for i in range(4):
            if i in self._pending_passes:
                passes[i] = self._pending_passes[i]
            else:
                passes[i] = self._pass_strategy.choose_cards_to_pass(
                    self._state.hand(i), self._state.pass_direction
                )
        self._state = apply_passes(self._state, passes)
        self._pending_passes.clear()
        self._last_round_ended = False

    # ── Play phase ──────────────────────────────────────────────────────

    def submit_play(
        self,
        seat_index: int,
        card: Card,
        *,
        on_play: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trick_complete: Optional[Callable[[], None]] = None,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        if self._state.phase != Phase.PLAYING:
            raise ValueError("Not in playing phase")
        if self._state.whose_turn != seat_index:
            raise ValueError("Not your turn")
        if not self._is_active_human(seat_index):
            raise ValueError("Not an active human seat")

        hand = self._state.hand(seat_index)
        if card not in hand:
            raise ValueError("Card not in hand")
        legal = get_legal_plays(
            hand,
            self._state.trick_list(),
            self._state.hearts_broken,
            first_lead_of_round=_is_first_lead(self._state, hand),
            first_trick=_is_first_trick_of_round(self._state),
        )
        if card not in legal:
            raise ValueError("Illegal play")

        play_event = {"player_index": seat_index, "card": card.to_code()}
        self._last_play_events = [play_event]
        self._last_round_ended = False
        self._state = apply_play(self._state, seat_index, card)
        if on_play:
            on_play(play_event)
        if (
            on_trick_complete
            and self._state.phase == Phase.PLAYING
            and len(self._state.current_trick) == 0
        ):
            on_trick_complete()
        self._run_ai_until_human_or_done(
            on_play=on_play,
            on_trick_complete=on_trick_complete,
            on_done=on_done,
        )

    def _handle_round_end_if_needed(
        self,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> Optional[str]:
        if not _round_complete(self._state):
            return None
        self._state = apply_round_scoring(self._state)
        if self._state.game_over:
            if on_done:
                on_done({"game_over": True})
            return "stop"
        self._last_round_ended = True
        hands = deal_into_4_hands(shuffle_deck(deck_52(), rng=self._rng))
        self._state = deal_new_round(
            self._state.scores,
            self._state.round + 1,
            hands,
        )
        self._pending_passes.clear()
        if on_done:
            on_done({"round_just_ended": True})
        self._last_round_ended = False
        return "stop"

    def _run_ai_until_human_or_done(
        self,
        on_play: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trick_complete: Optional[Callable[[], None]] = None,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        while not self._state.game_over and self._state.phase == Phase.PLAYING:
            if self._handle_round_end_if_needed(on_done):
                return
            player = self._state.whose_turn
            if self._is_active_human(player):
                if on_done:
                    on_done({})
                return
            hand = self._state.hand(player)
            legal = get_legal_plays(
                hand,
                self._state.trick_list(),
                self._state.hearts_broken,
                first_lead_of_round=_is_first_lead(self._state, hand),
                first_trick=_is_first_trick_of_round(self._state),
            )
            card = self._play_strategy.choose_play(self._state, player, legal)
            play_event = {"player_index": player, "card": card.to_code()}
            self._last_play_events.append(play_event)
            self._state = apply_play(self._state, player, card)
            if on_play:
                on_play(play_event)
            if (
                on_trick_complete
                and self._state.phase == Phase.PLAYING
                and len(self._state.current_trick) == 0
            ):
                on_trick_complete()
            if self._handle_round_end_if_needed(on_done):
                return

    def advance_to_human_turn(
        self,
        *,
        on_play: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trick_complete: Optional[Callable[[], None]] = None,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        self._last_play_events = []
        self._last_round_ended = False
        self._run_ai_until_human_or_done(
            on_play=on_play,
            on_trick_complete=on_trick_complete,
            on_done=on_done,
        )

    # ── Concede ─────────────────────────────────────────────────────────

    def concede_player(self, seat_index: int) -> str:
        """Mark a player as conceded (AI takeover). Returns 'conceded' or 'terminated'."""
        seat = self._seats[seat_index]
        if not seat.is_human or seat.conceded:
            raise ValueError("Seat is not an active human")
        seat.conceded = True
        seat.name = f"{seat.name} (Bot)"

        # Remove any pending pass from this player (AI will generate it)
        self._pending_passes.pop(seat_index, None)

        if self._all_humans_conceded():
            self._state = GameState(
                round=self._state.round,
                phase=self._state.phase,
                pass_direction=self._state.pass_direction,
                hands=self._state.hands,
                current_trick=self._state.current_trick,
                whose_turn=self._state.whose_turn,
                scores=self._state.scores,
                round_scores=self._state.round_scores,
                hearts_broken=self._state.hearts_broken,
                game_over=True,
                winner_index=None,
            )
            return "terminated"

        # If it was this player's turn to pass and all remaining humans have
        # submitted, apply passes now
        if self._state.phase == Phase.PASSING:
            humans_needing_pass = [i for i in range(4) if self._is_active_human(i)]
            if humans_needing_pass and all(
                i in self._pending_passes for i in humans_needing_pass
            ):
                self._apply_all_passes()

        return "conceded"

    # ── State views ─────────────────────────────────────────────────────

    def get_state_for_player(self, seat_index: int) -> Dict[str, Any]:
        s = self._state
        players = []
        for i in range(4):
            players.append(
                {
                    "name": self._seats[i].name,
                    "score": int(s.scores[i]),
                    "card_count": len(s.hands[i]),
                    "is_human": self._seats[i].is_human,
                    "conceded": self._seats[i].conceded,
                    "icon": self._seats[i].icon,
                }
            )
        my_hand = [c.to_code() for c in s.hand(seat_index)]
        legal_plays: List[str] = []
        if (
            s.phase == Phase.PLAYING
            and s.whose_turn == seat_index
            and not s.game_over
            and self._is_active_human(seat_index)
        ):
            hand = s.hand(seat_index)
            legal_cards = get_legal_plays(
                hand,
                s.trick_list(),
                s.hearts_broken,
                first_lead_of_round=_is_first_lead(s, hand),
                first_trick=_is_first_trick_of_round(s),
            )
            legal_plays = [c.to_code() for c in legal_cards]
        current_trick = [
            {"player_index": idx, "card": card.to_code()}
            for idx, card in s.current_trick
        ]

        pass_submitted = seat_index in self._pending_passes

        return {
            "phase": s.phase.value,
            "round": s.round,
            "pass_direction": s.pass_direction.value,
            "players": players,
            "my_hand": my_hand,
            "legal_plays": legal_plays,
            "current_trick": current_trick,
            "whose_turn": s.whose_turn,
            "hearts_broken": s.hearts_broken,
            "game_over": s.game_over,
            "winner_index": s.winner_index,
            "my_seat": seat_index,
            "pass_submitted": pass_submitted,
            "round_just_ended": self._last_round_ended,
        }

    def get_state_for_spectator(self) -> Dict[str, Any]:
        s = self._state
        players = []
        for i in range(4):
            players.append(
                {
                    "name": self._seats[i].name,
                    "score": int(s.scores[i]),
                    "card_count": len(s.hands[i]),
                    "is_human": self._seats[i].is_human,
                    "conceded": self._seats[i].conceded,
                    "icon": self._seats[i].icon,
                }
            )
        current_trick = [
            {"player_index": idx, "card": card.to_code()}
            for idx, card in s.current_trick
        ]
        return {
            "phase": s.phase.value,
            "round": s.round,
            "pass_direction": s.pass_direction.value,
            "players": players,
            "my_hand": [],
            "legal_plays": [],
            "current_trick": current_trick,
            "whose_turn": s.whose_turn,
            "hearts_broken": s.hearts_broken,
            "game_over": s.game_over,
            "winner_index": s.winner_index,
            "my_seat": None,
            "pass_submitted": False,
            "round_just_ended": self._last_round_ended,
        }

    def get_last_play_events(self) -> List[Dict[str, Any]]:
        return list(self._last_play_events)

    def get_last_round_ended(self) -> bool:
        return self._last_round_ended

    # ── Serialization ───────────────────────────────────────────────────

    def to_dict(self) -> Dict[str, Any]:
        s = self._state
        rng_state = self._rng.getstate()
        pending = {
            str(k): [c.to_code() for c in v] for k, v in self._pending_passes.items()
        }
        return {
            "state": {
                "round": s.round,
                "phase": s.phase.value,
                "pass_direction": s.pass_direction.value,
                "hands": [[c.to_code() for c in s.hands[i]] for i in range(4)],
                "current_trick": [
                    [idx, card.to_code()] for idx, card in s.current_trick
                ],
                "whose_turn": s.whose_turn,
                "scores": list(s.scores),
                "round_scores": list(s.round_scores),
                "hearts_broken": s.hearts_broken,
                "game_over": s.game_over,
                "winner_index": s.winner_index,
            },
            "seats": [sc.to_dict() for sc in self._seats],
            "difficulty": self._difficulty,
            "pending_passes": pending,
            "rng_state": [rng_state[0], list(rng_state[1]), rng_state[2]],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "MultiplayerRunner":
        sd = data["state"]
        hands = tuple(tuple(Card.from_code(c) for c in hand) for hand in sd["hands"])
        current_trick = tuple(
            (idx, Card.from_code(code)) for idx, code in sd["current_trick"]
        )
        state = GameState(
            round=sd["round"],
            phase=Phase(sd["phase"]),
            pass_direction=PassDirection(sd["pass_direction"]),
            hands=hands,
            current_trick=current_trick,
            whose_turn=sd["whose_turn"],
            scores=tuple(sd["scores"]),
            round_scores=tuple(sd["round_scores"]),
            hearts_broken=sd["hearts_broken"],
            game_over=sd["game_over"],
            winner_index=sd.get("winner_index"),
        )
        seats = [SeatConfig.from_dict(s) for s in data["seats"]]
        difficulty = data.get("difficulty", "easy")
        pass_strategy, play_strategy = create_strategies(difficulty)

        rng = random.Random()
        rng_raw = data.get("rng_state")
        if rng_raw:
            rng.setstate((rng_raw[0], tuple(rng_raw[1]), rng_raw[2]))

        runner = cls(
            state, pass_strategy, play_strategy, seats, rng=rng, difficulty=difficulty
        )

        pending_raw = data.get("pending_passes", {})
        for k, v in pending_raw.items():
            runner._pending_passes[int(k)] = [Card.from_code(c) for c in v]

        return runner

    @classmethod
    def from_json(cls, raw: str) -> "MultiplayerRunner":
        return cls.from_dict(json.loads(raw))
