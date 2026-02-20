"""
Game runner: holds state, submits human pass/play, runs AI until human turn or round end.
Exposes get_state_for_frontend() for the API.
Supports optional callbacks (on_play, on_trick_complete, on_done) for WebSocket streaming.
"""

import json
import random
from typing import Any, Callable, Dict, List, Optional

from hearts.game.card import Card, deck_52, shuffle_deck, deal_into_4_hands
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


HUMAN_PLAYER = 0
DEFAULT_PLAYER_NAMES = ("You", "AI 1", "AI 2", "AI 3")
AI_NAME_POOL = (
    "Mary",
    "John",
    "Duffy",
    "Mike",
    "Joe",
    "Nelson",
    "Brad",
    "Emily",
    "Kelly",
    "Megan",
    "Sue",
    "Bill",
    "Tim",
)


def _round_complete(state: GameState) -> bool:
    """True if all 13 tricks have been played this round (all hands empty)."""
    return sum(len(state.hands[i]) for i in range(4)) == 0


class GameRunner:
    """
    Holds current game state. Human is player 0; AI are 1, 2, 3.
    submit_pass(human_cards): apply human + AI passes, transition to playing.
    submit_play(card): play human card, then run AI until human's turn or round/game end.
    """

    def __init__(
        self,
        state: GameState,
        pass_strategy: PassStrategy,
        play_strategy: PlayStrategy,
        player_names: Optional[tuple] = None,
        rng: Optional[random.Random] = None,
        difficulty: str = "easy",
    ) -> None:
        self._state = state
        self._pass_strategy = pass_strategy
        self._play_strategy = play_strategy
        self._player_names = player_names or DEFAULT_PLAYER_NAMES
        self._rng = rng or random.Random()
        self._difficulty = difficulty
        self._human_moon_shots: int = 0
        self._last_play_events: List[Dict[str, Any]] = []
        self._last_round_ended: bool = False

    @property
    def state(self) -> GameState:
        return self._state

    @classmethod
    def new_game(
        cls,
        pass_strategy: PassStrategy,
        play_strategy: PlayStrategy,
        player_names: Optional[tuple] = None,
        human_name: Optional[str] = None,
        rng: Optional[random.Random] = None,
        difficulty: str = "easy",
    ) -> "GameRunner":
        """Create a new game: deal, initial state (round 1, passing or no-pass)."""
        rng = rng or random.Random()
        deck = shuffle_deck(deck_52(), rng=rng)
        hands = deal_into_4_hands(deck)
        state = deal_new_round((0, 0, 0, 0), 1, hands)
        if player_names:
            names = list(player_names)
            while len(names) < 4:
                names.append(DEFAULT_PLAYER_NAMES[len(names)])
        else:
            ai_names = rng.sample(AI_NAME_POOL, 3)
            names = ["You", *ai_names]
        if human_name is not None:
            names[0] = human_name
        return cls(
            state,
            pass_strategy,
            play_strategy,
            tuple(names),
            rng=rng,
            difficulty=difficulty,
        )

    def submit_pass(self, human_cards: List[Card]) -> None:
        """
        Submit human's 3 cards to pass. Validate, get AI passes, apply_passes, update state.
        Raises ValueError if invalid (wrong phase, invalid pass).
        """
        if self._state.phase != Phase.PASSING:
            raise ValueError("Not in passing phase")
        hand0 = self._state.hand(HUMAN_PLAYER)
        if not is_valid_pass(hand0, human_cards):
            raise ValueError(
                "Invalid pass: must select exactly 3 cards from your hand, no duplicates"
            )
        passes = [
            human_cards,
            self._pass_strategy.choose_cards_to_pass(
                self._state.hand(1), self._state.pass_direction
            ),
            self._pass_strategy.choose_cards_to_pass(
                self._state.hand(2), self._state.pass_direction
            ),
            self._pass_strategy.choose_cards_to_pass(
                self._state.hand(3), self._state.pass_direction
            ),
        ]
        self._state = apply_passes(self._state, passes)

    def submit_play(
        self,
        card: Card,
        *,
        on_play: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trick_complete: Optional[Callable[[], None]] = None,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        """
        Play human's card. Validate, apply, then run AI until human's turn or round end.
        Optional callbacks are used for WebSocket streaming.
        """
        if self._state.phase != Phase.PLAYING:
            raise ValueError("Not in playing phase")
        if self._state.whose_turn != HUMAN_PLAYER:
            raise ValueError("Not your turn")
        hand0 = self._state.hand(HUMAN_PLAYER)
        if card not in hand0:
            raise ValueError("Card not in hand")
        legal = get_legal_plays(
            hand0,
            self._state.trick_list(),
            self._state.hearts_broken,
            first_lead_of_round=_is_first_lead(self._state, hand0),
            first_trick=_is_first_trick_of_round(self._state),
        )
        if card not in legal:
            raise ValueError("Illegal play")
        play_event = {"player_index": HUMAN_PLAYER, "card": card.to_code()}
        self._last_play_events = [play_event]
        self._last_round_ended = False
        self._state = apply_play(self._state, HUMAN_PLAYER, card)
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
        """If the round is complete, score it and deal the next round.

        Returns None if round is not complete, or "stop" if the caller should
        return (game over or new round dealt).  Always stops at the round
        boundary so the client can show the round summary before continuing.
        """
        if not _round_complete(self._state):
            return None
        if self._state.round_scores[HUMAN_PLAYER] == 26:
            self._human_moon_shots += 1
        self._state = apply_round_scoring(self._state)
        if self._state.game_over:
            if on_done:
                on_done(self.get_state_for_frontend())
            return "stop"
        self._last_round_ended = True
        hands = deal_into_4_hands(shuffle_deck(deck_52(), rng=self._rng))
        self._state = deal_new_round(
            self._state.scores,
            self._state.round + 1,
            hands,
        )
        if on_done:
            payload = self.get_state_for_frontend()
            payload["round_just_ended"] = True
            on_done(payload)
        return "stop"

    def _run_ai_until_human_or_done(
        self,
        on_play: Optional[Callable[[Dict[str, Any]], None]] = None,
        on_trick_complete: Optional[Callable[[], None]] = None,
        on_done: Optional[Callable[[Dict[str, Any]], None]] = None,
    ) -> None:
        """Run AI turns until it's human's turn or game/round ends."""
        while not self._state.game_over and self._state.phase == Phase.PLAYING:
            if self._handle_round_end_if_needed(on_done):
                return
            if self._state.whose_turn == HUMAN_PLAYER:
                if on_done:
                    on_done(self.get_state_for_frontend())
                return
            player = self._state.whose_turn
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
        """
        Run AI turns until human's turn or round/game end.
        Optional callbacks are used for WebSocket streaming.
        """
        self._last_play_events = []
        self._last_round_ended = False
        self._run_ai_until_human_or_done(
            on_play=on_play,
            on_trick_complete=on_trick_complete,
            on_done=on_done,
        )

    def get_last_play_events(self) -> List[Dict[str, Any]]:
        """After submit_play or advance_to_human_turn, returns the list of { player_index, card } in order."""
        return list(self._last_play_events)

    def get_last_round_ended(self) -> bool:
        """After submit_play, True if the round just ended (scores applied, new round dealt)."""
        return self._last_round_ended

    @property
    def difficulty(self) -> str:
        return self._difficulty

    @property
    def human_moon_shots(self) -> int:
        return self._human_moon_shots

    # ── Serialization ────────────────────────────────────────────────────

    def to_dict(self) -> Dict[str, Any]:
        """Serialize full runner state to a JSON-friendly dict."""
        s = self._state
        rng_state = self._rng.getstate()
        # rng_state is (version, internalstate_tuple, gauss_next).
        # internalstate_tuple contains ints safe for JSON via list conversion.
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
            "player_names": list(self._player_names),
            "difficulty": self._difficulty,
            "human_moon_shots": self._human_moon_shots,
            "rng_state": [
                rng_state[0],
                list(rng_state[1]),
                rng_state[2],
            ],
        }

    def to_json(self) -> str:
        return json.dumps(self.to_dict())

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "GameRunner":
        """Reconstruct a GameRunner from a dict produced by to_dict()."""
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
        difficulty = data.get("difficulty", "easy")
        pass_strategy, play_strategy = create_strategies(difficulty)

        rng = random.Random()
        rng_raw = data.get("rng_state")
        if rng_raw:
            rng.setstate((rng_raw[0], tuple(rng_raw[1]), rng_raw[2]))

        runner = cls(
            state=state,
            pass_strategy=pass_strategy,
            play_strategy=play_strategy,
            player_names=tuple(data.get("player_names", DEFAULT_PLAYER_NAMES)),
            rng=rng,
            difficulty=difficulty,
        )
        runner._human_moon_shots = data.get("human_moon_shots", 0)
        return runner

    @classmethod
    def from_json(cls, raw: str) -> "GameRunner":
        return cls.from_dict(json.loads(raw))

    def get_state_for_frontend(self) -> Dict[str, Any]:
        """
        Return a JSON-friendly dict for the API. Includes legal_plays when
        phase is playing and it's human's turn.
        """
        s = self._state
        players = []
        for i in range(4):
            name = (
                self._player_names[i] if i < len(self._player_names) else f"Player {i}"
            )
            score = int(s.scores[i])
            card_count = len(s.hands[i])
            players.append({"name": name, "score": score, "card_count": card_count})
        human_hand = [c.to_code() for c in s.hand(HUMAN_PLAYER)]
        legal_plays: List[str] = []
        if (
            s.phase == Phase.PLAYING
            and s.whose_turn == HUMAN_PLAYER
            and not s.game_over
        ):
            hand0 = s.hand(HUMAN_PLAYER)
            legal_cards = get_legal_plays(
                hand0,
                s.trick_list(),
                s.hearts_broken,
                first_lead_of_round=_is_first_lead(s, hand0),
                first_trick=_is_first_trick_of_round(s),
            )
            legal_plays = [c.to_code() for c in legal_cards]
        # current_trick in play order: slot 0 = 1st play (bottom), 1 = 2nd (left), 2 = 3rd (top), 3 = 4th (right)
        current_trick = [
            {"player_index": idx, "card": card.to_code()}
            for idx, card in s.current_trick
        ]
        return {
            "phase": s.phase.value,
            "round": s.round,
            "pass_direction": s.pass_direction.value,
            "players": players,
            "human_hand": human_hand,
            "legal_plays": legal_plays,
            "current_trick": current_trick,
            "whose_turn": s.whose_turn,
            "hearts_broken": s.hearts_broken,
            "game_over": s.game_over,
            "winner_index": s.winner_index,
            "human_moon_shots": self._human_moon_shots,
        }
