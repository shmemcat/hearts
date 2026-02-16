"""
Game runner: holds state, submits human pass/play, runs AI until human turn or round end.
Exposes get_state_for_frontend() for the API.
"""

import random
from typing import Any, Dict, List, Optional

from hearts.game.card import Card, deck_52, shuffle_deck, deal_into_4_hands, two_of_clubs
from hearts.game.rules import get_legal_plays, is_valid_pass
from hearts.game.state import GameState, Phase, PassDirection
from hearts.game.transitions import (
    apply_passes,
    apply_play,
    apply_round_scoring,
    deal_new_round,
)

from hearts.ai.base import PassStrategy, PlayStrategy


HUMAN_PLAYER = 0
DEFAULT_PLAYER_NAMES = ("You", "AI 1", "AI 2", "AI 3")


def _is_first_trick_of_round(state: GameState) -> bool:
    total_played = sum(13 - len(state.hands[i]) for i in range(4))
    return total_played < 4


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
    ) -> None:
        self._state = state
        self._pass_strategy = pass_strategy
        self._play_strategy = play_strategy
        self._player_names = player_names or DEFAULT_PLAYER_NAMES
        self._rng = rng or random.Random()
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
    ) -> "GameRunner":
        """Create a new game: deal, initial state (round 1, passing or no-pass)."""
        rng = rng or random.Random()
        deck = shuffle_deck(deck_52(), rng=rng)
        hands = deal_into_4_hands(deck)
        state = deal_new_round((0, 0, 0, 0), 1, hands)
        names = list(player_names) if player_names else list(DEFAULT_PLAYER_NAMES)
        while len(names) < 4:
            names.append(DEFAULT_PLAYER_NAMES[len(names)])
        if human_name is not None and len(names) > 0:
            names[0] = human_name
        return cls(
            state,
            pass_strategy,
            play_strategy,
            tuple(names),
            rng=rng,
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

    def submit_play(self, card: Card) -> None:
        """
        Play human's card. Validate, apply, then run AI turns until human's turn again
        or round/game ends. When a round ends, apply_round_scoring and optionally
        deal_new_round; if new round is passing phase, stop (API will call submit_pass next).
        """
        if self._state.phase != Phase.PLAYING:
            raise ValueError("Not in playing phase")
        if self._state.whose_turn != HUMAN_PLAYER:
            raise ValueError("Not your turn")
        hand0 = self._state.hand(HUMAN_PLAYER)
        if card not in hand0:
            raise ValueError("Card not in hand")
        trick_list = self._state.trick_list()
        is_first_trick = _is_first_trick_of_round(self._state)
        first_lead = (
            len(trick_list) == 0
            and is_first_trick
            and two_of_clubs() in hand0
        )
        legal = get_legal_plays(
            hand0,
            trick_list,
            is_first_trick,
            self._state.hearts_broken,
            first_lead_of_round=first_lead,
        )
        if card not in legal:
            raise ValueError("Illegal play")
        self._last_play_events = [{"player_index": HUMAN_PLAYER, "card": card.to_code()}]
        self._last_round_ended = False
        self._state = apply_play(self._state, HUMAN_PLAYER, card)
        self._run_ai_until_human_or_done()

    def _run_ai_until_human_or_done(self) -> None:
        """Run AI turns until it's human's turn or game/round ends (passing phase)."""
        while not self._state.game_over and self._state.phase == Phase.PLAYING:
            if self._state.whose_turn == HUMAN_PLAYER:
                return
            player = self._state.whose_turn
            hand = self._state.hand(player)
            trick_list = self._state.trick_list()
            is_first_trick = _is_first_trick_of_round(self._state)
            first_lead = (
                len(trick_list) == 0
                and is_first_trick
                and two_of_clubs() in hand
            )
            legal = get_legal_plays(
                hand,
                trick_list,
                is_first_trick,
                self._state.hearts_broken,
                first_lead_of_round=first_lead,
            )
            card = self._play_strategy.choose_play(
                self._state, player, legal
            )
            self._last_play_events.append(
                {"player_index": player, "card": card.to_code()}
            )
            self._state = apply_play(self._state, player, card)
            if _round_complete(self._state):
                self._state = apply_round_scoring(self._state)
                if self._state.game_over:
                    return
                self._last_round_ended = True
                hands = deal_into_4_hands(
                    shuffle_deck(deck_52(), rng=self._rng)
                )
                self._state = deal_new_round(
                    self._state.scores,
                    self._state.round + 1,
                    hands,
                )
                if self._state.phase == Phase.PASSING:
                    return

    def advance_to_human_turn(self) -> None:
        """
        Run AI turns from current state until human's turn or round/game end.
        Use when it's an AI's turn (e.g. AI has 2♣ after pass). Records plays in _last_play_events.
        """
        self._last_play_events = []
        self._last_round_ended = False
        self._run_ai_until_human_or_done()

    def get_last_play_events(self) -> List[Dict[str, Any]]:
        """After submit_play or advance_to_human_turn, returns the list of { player_index, card } in order."""
        return list(self._last_play_events)

    def get_last_round_ended(self) -> bool:
        """After submit_play, True if the round just ended (scores applied, new round dealt)."""
        return self._last_round_ended

    def get_state_for_frontend(self) -> Dict[str, Any]:
        """
        Return a JSON-friendly dict for the API. Includes legal_plays when
        phase is playing and it's human's turn.
        """
        s = self._state
        players = []
        for i in range(4):
            name = self._player_names[i] if i < len(self._player_names) else f"Player {i}"
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
            trick_list = s.trick_list()
            is_first_trick = _is_first_trick_of_round(s)
            first_lead = (
                len(trick_list) == 0
                and is_first_trick
                and two_of_clubs() in hand0
            )
            legal_cards = get_legal_plays(
                hand0,
                trick_list,
                is_first_trick,
                s.hearts_broken,
                first_lead_of_round=first_lead,
            )
            legal_plays = [c.to_code() for c in legal_cards]
        current_trick_by_player: List[Optional[Dict[str, Any]]] = [
            None,
            None,
            None,
            None,
        ]
        for idx, card in s.current_trick:
            current_trick_by_player[idx] = {
                "player_index": idx,
                "card": card.to_code(),
            }
        return {
            "phase": s.phase.value,
            "round": s.round,
            "pass_direction": s.pass_direction.value,
            "players": players,
            "human_hand": human_hand,
            "legal_plays": legal_plays,
            "current_trick": current_trick_by_player,
            "whose_turn": s.whose_turn,
            "hearts_broken": s.hearts_broken,
            "game_over": s.game_over,
            "winner_index": s.winner_index,
        }
