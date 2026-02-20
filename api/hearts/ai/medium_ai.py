"""
Rule-based pass and play strategies for medium difficulty.
Follows conventional Hearts heuristics: avoid taking points, dump dangerous
cards, manage spade danger, and create voids for future dumping.
"""

import random
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

from hearts.game.card import Card, Suit, QUEEN_OF_SPADES_RANK
from hearts.game.state import GameState, PassDirection
from hearts.ai.base import PassStrategy, PlayStrategy

_QS = Card(Suit.SPADES, QUEEN_OF_SPADES_RANK)


# ---------------------------------------------------------------------------
# Passing helpers
# ---------------------------------------------------------------------------


def _pass_danger(card: Card, hand: List[Card]) -> float:
    """Score how dangerous a card is to keep.  Higher = should be passed."""
    # Queen of Spades: always pass
    if card == _QS:
        return 200.0

    # King / Ace of Spades sit above QS -- very dangerous
    if card.suit == Suit.SPADES and card.rank > QUEEN_OF_SPADES_RANK:
        return 150.0 + card.rank

    score = float(card.rank)

    # Hearts carry points; high hearts are especially bad
    if card.suit == Suit.HEARTS:
        score += 50.0

    # Bonus for passing from short suits (creates voids faster)
    suit_len = sum(1 for c in hand if c.suit == card.suit)
    if suit_len <= 2:
        score += 30.0
    elif suit_len <= 3:
        score += 15.0

    return score


# ---------------------------------------------------------------------------
# Passing strategy
# ---------------------------------------------------------------------------


class MediumPassStrategy(PassStrategy):
    """Pass the 3 most dangerous cards using conventional Hearts wisdom."""

    def __init__(self, rng: Optional[random.Random] = None) -> None:
        self._rng = rng or random.Random()

    def choose_cards_to_pass(
        self,
        hand: List[Card],
        direction: PassDirection,
    ) -> List[Card]:
        if len(hand) < 3:
            raise ValueError("Hand must have at least 3 cards to pass")
        ranked = sorted(hand, key=lambda c: _pass_danger(c, hand), reverse=True)
        return ranked[:3]


# ---------------------------------------------------------------------------
# Play strategy
# ---------------------------------------------------------------------------


class MediumPlayStrategy(PlayStrategy):
    """Play using conventional Hearts heuristics."""

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
        if len(legal_plays) == 1:
            return legal_plays[0]

        trick = state.trick_list()

        if not trick:
            return self._lead(legal_plays, state)

        lead_suit = trick[0][1].suit
        in_suit = [c for c in legal_plays if c.suit == lead_suit]
        if in_suit:
            return self._follow(in_suit, trick, lead_suit)
        return self._dump(legal_plays)

    # -- leading -----------------------------------------------------------

    def _lead(self, legal: List[Card], state: GameState) -> Card:
        qs_out = _qs_maybe_out(legal, state)

        by_suit: Dict[Suit, List[Card]] = defaultdict(list)
        for c in legal:
            by_suit[c.suit].append(c)

        # Build a priority ordering of suits to lead from
        order: List[Suit] = []
        for s in (Suit.CLUBS, Suit.DIAMONDS):
            if s in by_suit:
                order.append(s)
        if not qs_out and Suit.SPADES in by_suit:
            order.append(Suit.SPADES)
        if state.hearts_broken and Suit.HEARTS in by_suit:
            order.append(Suit.HEARTS)
        # Fallback: remaining suits
        for s in (Suit.SPADES, Suit.HEARTS):
            if s in by_suit and s not in order:
                order.append(s)

        best = max(order, key=lambda s: len(by_suit[s]))
        candidates = [c for c in by_suit[best] if c != _QS] or by_suit[best]
        return min(candidates, key=lambda c: c.rank)

    # -- following suit ----------------------------------------------------

    @staticmethod
    def _follow(
        in_suit: List[Card],
        trick: List[Tuple[int, Card]],
        lead_suit: Suit,
    ) -> Card:
        high = max(
            (c.rank for _, c in trick if c.suit == lead_suit),
            default=0,
        )
        below = [c for c in in_suit if c.rank < high]
        if below:
            # Duck: play the highest card that still loses to the current winner
            return max(below, key=lambda c: c.rank)
        # Forced to take -- dump the highest card to get rid of danger
        return max(in_suit, key=lambda c: c.rank)

    # -- dumping (void in lead suit) ---------------------------------------

    @staticmethod
    def _dump(legal: List[Card]) -> Card:
        # Priority 1: Queen of Spades (13 points to the trick taker!)
        if _QS in legal:
            return _QS
        # Priority 2: highest heart
        hearts = [c for c in legal if c.suit == Suit.HEARTS]
        if hearts:
            return max(hearts, key=lambda c: c.rank)
        # Priority 3: high spades above QS (King, Ace)
        high_spades = [
            c for c in legal if c.suit == Suit.SPADES and c.rank > QUEEN_OF_SPADES_RANK
        ]
        if high_spades:
            return max(high_spades, key=lambda c: c.rank)
        # Priority 4: highest card from any suit
        return max(legal, key=lambda c: c.rank)


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------


def _qs_maybe_out(hand: List[Card], state: GameState) -> bool:
    """True if QS might still be lurking in an opponent's hand."""
    if _QS in hand:
        return False
    # If any player already took 13+ round points, QS was likely played
    if any(s >= 13 for s in state.round_scores):
        return False
    return True
