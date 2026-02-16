"""
Abstract strategy interfaces for Hearts AI. Engine calls these; no I/O.
"""

from abc import ABC, abstractmethod
from typing import List

from hearts.game.card import Card
from hearts.game.state import GameState, PassDirection


class PassStrategy(ABC):
    """Choose exactly 3 cards to pass. Caller ensures hand has 13+ cards."""

    @abstractmethod
    def choose_cards_to_pass(
        self,
        hand: List[Card],
        direction: PassDirection,
    ) -> List[Card]:
        """Return exactly 3 cards from hand. Caller validates with is_valid_pass."""
        ...


class PlayStrategy(ABC):
    """Choose one card to play from legal_plays. Caller provides state and legal list."""

    @abstractmethod
    def choose_play(
        self,
        state: GameState,
        player_index: int,
        legal_plays: List[Card],
    ) -> Card:
        """Return one card from legal_plays. Caller validates and applies via transition."""
        ...
