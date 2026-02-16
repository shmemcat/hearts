"""
Card, Suit, Rank, and Deck for Hearts.
Card codes in API: "2c", "10d", "Js", "Ah" (rank + suit c/d/s/h).
Internal: Suit 0-3 (c,d,s,h), Rank 2-14 (2..10, J=11, Q=12, K=13, A=14).
"""

import random
from dataclasses import dataclass
from enum import IntEnum
from typing import List, Optional


class Suit(IntEnum):
    CLUBS = 0
    DIAMONDS = 1
    SPADES = 2
    HEARTS = 3


# Rank: 2=2, 3=3, ..., 10=10, J=11, Q=12, K=13, A=14
RANK_MIN = 2
RANK_MAX = 14

# Queen of Spades for scoring
QUEEN_OF_SPADES_RANK = 12

SUIT_CODE = {"c": Suit.CLUBS, "d": Suit.DIAMONDS, "s": Suit.SPADES, "h": Suit.HEARTS}
CODE_SUIT = {s: c for c, s in SUIT_CODE.items()}

RANK_TO_CODE = {
    2: "2",
    3: "3",
    4: "4",
    5: "5",
    6: "6",
    7: "7",
    8: "8",
    9: "9",
    10: "10",
    11: "J",
    12: "Q",
    13: "K",
    14: "A",
}
CODE_TO_RANK = {v: k for k, v in RANK_TO_CODE.items()}


@dataclass(frozen=True)
class Card:
    suit: Suit
    rank: int  # 2-14

    def __post_init__(self) -> None:
        if not (RANK_MIN <= self.rank <= RANK_MAX):
            raise ValueError(f"Rank must be {RANK_MIN}-{RANK_MAX}, got {self.rank}")

    def to_code(self) -> str:
        return RANK_TO_CODE[self.rank] + CODE_SUIT[self.suit]

    @staticmethod
    def from_code(code: str) -> "Card":
        code = code.strip()
        if not code:
            raise ValueError("Empty card code")
        suit_char = code[-1].lower()
        rank_str = code[:-1]
        if suit_char not in SUIT_CODE:
            raise ValueError(f"Invalid suit in card code: {code}")
        if rank_str not in CODE_TO_RANK:
            raise ValueError(f"Invalid rank in card code: {code}")
        return Card(suit=SUIT_CODE[suit_char], rank=CODE_TO_RANK[rank_str])

    def __str__(self) -> str:
        return self.to_code()

    def __repr__(self) -> str:
        return f"Card({self.to_code()})"


def deck_52() -> List[Card]:
    """Standard 52-card deck in suit order (c, d, s, h), rank 2-A."""
    return [
        Card(suit=s, rank=r)
        for s in (Suit.CLUBS, Suit.DIAMONDS, Suit.SPADES, Suit.HEARTS)
        for r in range(RANK_MIN, RANK_MAX + 1)
    ]


def shuffle_deck(deck: List[Card], rng: Optional[random.Random] = None) -> List[Card]:
    """Return a new shuffled list of cards. Does not mutate the input."""
    out = list(deck)
    (rng or random).shuffle(out)
    return out


def deal_into_4_hands(deck: List[Card]) -> List[List[Card]]:
    """Deal 52 cards into 4 hands of 13. One at a time, clockwise: p0, p1, p2, p3, p0, ..."""
    if len(deck) != 52:
        raise ValueError(f"Deck must have 52 cards, got {len(deck)}")
    return [[deck[i + j * 4] for j in range(13)] for i in range(4)]


def two_of_clubs() -> Card:
    """The card that must be led on the first trick (after passes)."""
    return Card(suit=Suit.CLUBS, rank=2)
