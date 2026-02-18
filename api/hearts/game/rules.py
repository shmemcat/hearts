"""
Pure rule functions for Hearts. No I/O, no mutation.
Bicycle rules: follow suit, first trick must lead 2♣,
leading a heart breaks hearts, trick winner = highest in lead suit.
"""

from typing import List, Tuple

from hearts.game.card import (
    Card,
    Suit,
    QUEEN_OF_SPADES_RANK,
    two_of_clubs,
)


def get_legal_plays(
    hand: List[Card],
    trick: List[Tuple[int, Card]],
    hearts_broken: bool,
    *,
    first_lead_of_round: bool = False,
) -> List[Card]:
    """
    Return the list of cards the current player may play.
    - first_lead_of_round: if True and hand contains 2♣, only 2♣ is legal (first lead after pass).
    - If leading (trick empty): any card may be led (leading a heart breaks hearts).
    - If following: must follow suit if possible.
    """
    if not hand:
        return []

    if first_lead_of_round:
        two_c = two_of_clubs()
        if two_c in hand:
            return [two_c]

    if not trick:
        return list(hand)

    lead_card = trick[0][1]
    lead_suit = lead_card.suit
    in_lead_suit = [c for c in hand if c.suit == lead_suit]

    if in_lead_suit:
        return in_lead_suit

    # Void in lead suit: may play any card (first trick we're void in clubs so hearts/Q♠ allowed)
    return list(hand)


def get_trick_winner(trick: List[Tuple[int, Card]], lead_suit: Suit) -> int:
    """Return the player_index (0-3) who wins the trick. Highest card of the lead suit wins."""
    if not trick:
        raise ValueError("Empty trick has no winner")
    lead_suit_cards = [(i, c) for i, c in trick if c.suit == lead_suit]
    if not lead_suit_cards:
        raise ValueError("Trick has no card in lead suit")
    winner_idx, winner_card = max(lead_suit_cards, key=lambda x: x[1].rank)
    return winner_idx


def get_trick_points(trick: List[Tuple[int, Card]]) -> int:
    """Return total points in the trick: 1 per heart, 13 for Queen of Spades."""
    total = 0
    for _, card in trick:
        if card.suit == Suit.HEARTS:
            total += 1
        elif card.suit == Suit.SPADES and card.rank == QUEEN_OF_SPADES_RANK:
            total += 13
    return total


def is_valid_pass(hand: List[Card], three_cards: List[Card]) -> bool:
    """Return True iff exactly 3 cards, all in hand, no duplicates."""
    if len(three_cards) != 3:
        return False
    hand_set = set(hand)
    if len(three_cards) != len(set(three_cards)):
        return False
    return all(c in hand_set for c in three_cards)
