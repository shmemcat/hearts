"""
Canonical game state for Hearts. Immutable-friendly: transitions return new state.
"""

from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Tuple

from hearts.game.card import Card, two_of_clubs


class Phase(str, Enum):
    PASSING = "passing"
    PLAYING = "playing"


class PassDirection(str, Enum):
    LEFT = "left"
    RIGHT = "right"
    ACROSS = "across"
    NONE = "none"


@dataclass(frozen=True)
class GameState:
    """
    Full game state. hands[i] is player i's hand (0=human, 1-3=AI).
    current_trick: list of (player_index, card) in play order.
    whose_turn: player index who must act (during play phase).
    scores: total points per player (list of 4 ints).
    round_scores: points taken this round per player (for shoot-the-moon); applied at round end.
    """

    round: int  # 1-based for display
    phase: Phase
    pass_direction: PassDirection
    hands: Tuple[Tuple[Card, ...], ...]  # 4 hands, each tuple of Card
    current_trick: Tuple[Tuple[int, Card], ...]  # (player_index, card) in order played
    whose_turn: int  # 0-3
    scores: Tuple[int, ...]  # 4 totals
    round_scores: Tuple[int, ...]  # 4 points taken this round (before round scoring)
    hearts_broken: bool
    game_over: bool
    winner_index: Optional[int] = None  # when game_over, lowest score wins

    def hand(self, player_index: int) -> List[Card]:
        return list(self.hands[player_index])

    def trick_list(self) -> List[Tuple[int, Card]]:
        return list(self.current_trick)

    @staticmethod
    def pass_direction_for_round(round_num: int) -> PassDirection:
        """Round 1→left, 2→right, 3→across, 4→none, then repeat."""
        r = (round_num - 1) % 4
        if r == 0:
            return PassDirection.LEFT
        if r == 1:
            return PassDirection.RIGHT
        if r == 2:
            return PassDirection.ACROSS
        return PassDirection.NONE


def initial_state_after_deal(
    hands: List[List[Card]],
    round_num: int = 1,
    previous_scores: Optional[Tuple[int, ...]] = None,
) -> GameState:
    """
    Build state right after deal. When round_num % 4 != 0: phase=passing.
    When round_num % 4 == 0 (no pass): phase=playing, whose_turn=holder of 2♣.
    previous_scores: 4 totals to carry over (default (0,0,0,0) for round 1).
    """
    if len(hands) != 4 or any(len(h) != 13 for h in hands):
        raise ValueError("Need 4 hands of 13 cards each")
    scores = previous_scores if previous_scores is not None else (0, 0, 0, 0)
    if len(scores) != 4:
        raise ValueError("previous_scores must have length 4")
    pass_dir = GameState.pass_direction_for_round(round_num)
    hands_t = tuple(tuple(h) for h in hands)
    if round_num % 4 == 0:
        two_c = two_of_clubs()
        first_leader = next(
            (i for i in range(4) if two_c in hands[i]),
            None,
        )
        if first_leader is None:
            raise ValueError("2♣ not in any hand")
        return GameState(
            round=round_num,
            phase=Phase.PLAYING,
            pass_direction=PassDirection.NONE,
            hands=hands_t,
            current_trick=(),
            whose_turn=first_leader,
            scores=tuple(scores),
            round_scores=(0, 0, 0, 0),
            hearts_broken=False,
            game_over=False,
            winner_index=None,
        )
    return GameState(
        round=round_num,
        phase=Phase.PASSING,
        pass_direction=pass_dir,
        hands=hands_t,
        current_trick=(),
        whose_turn=0,
        scores=tuple(scores),
        round_scores=(0, 0, 0, 0),
        hearts_broken=False,
        game_over=False,
        winner_index=None,
    )
