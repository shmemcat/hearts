"""Shared fixtures for hearts engine and API tests."""

import pytest

from hearts.game.card import Card, Suit, deck_52, shuffle_deck, deal_into_4_hands, two_of_clubs
from hearts.game.state import GameState, Phase, PassDirection, initial_state_after_deal


@pytest.fixture
def rng():
    """Fixed seed for reproducible tests."""
    import random
    return random.Random(42)


@pytest.fixture
def deck(rng):
    return shuffle_deck(deck_52(), rng=rng)


@pytest.fixture
def four_hands(deck):
    return deal_into_4_hands(deck)


@pytest.fixture
def state_passing(four_hands):
    """Round 1, passing phase."""
    return initial_state_after_deal(four_hands, round_num=1)


@pytest.fixture
def state_playing_after_pass(state_passing):
    """State after applying 4 dummy passes (each player passes first 3 cards)."""
    from hearts.game.transitions import apply_passes
    hands = [list(state_passing.hands[i]) for i in range(4)]
    passes = [[hands[i][j] for j in range(3)] for i in range(4)]
    return apply_passes(state_passing, passes)


@pytest.fixture
def client():
    """Flask test client for API route tests."""
    from hearts import app
    app.config["TESTING"] = True
    return app.test_client()
