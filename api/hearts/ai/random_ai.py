"""
Random valid pass and play. Used for "easy" AI.
"""

import random
from typing import List, Optional

from hearts.game.card import Card
from hearts.game.state import GameState, PassDirection

from hearts.ai.base import PassStrategy, PlayStrategy


class RandomPassStrategy(PassStrategy):
    """Choose 3 random cards from hand. Caller must pass a hand of 13 cards."""

    def __init__(self, rng: Optional[random.Random] = None) -> None:
        self._rng = rng or random.Random()

    def choose_cards_to_pass(
        self,
        hand: List[Card],
        direction: PassDirection,
    ) -> List[Card]:
        if len(hand) < 3:
            raise ValueError("Hand must have at least 3 cards to pass")
        return self._rng.sample(hand, 3)


class RandomPlayStrategy(PlayStrategy):
    """Choose a random card from legal_plays."""

    def __init__(self, rng: Optional[random.Random] = None) -> None:
        self._rng = rng or random.Random()

    def choose_play(
        self,
        state: GameState,
        player_index: int,
        legal_plays: List[Card],
    ) -> Card:
        if not legal_plays:
            raise ValueError("No legal plays")
        return self._rng.choice(legal_plays)
