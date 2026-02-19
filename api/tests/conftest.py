"""Shared fixtures for hearts engine and API tests."""

import os
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta

from hearts.game.card import Card, Suit, deck_52, shuffle_deck, deal_into_4_hands, two_of_clubs
from hearts.game.state import GameState, Phase, PassDirection, initial_state_after_deal

JWT_SECRET = "test-secret-key-for-hearts"


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
    from hearts.extensions import db
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.drop_all()


@pytest.fixture
def auth_client():
    """Flask test client with JWT_SECRET set and rate limiting disabled for auth tests."""
    from hearts import app
    from hearts.extensions import db, limiter
    app.config["TESTING"] = True
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
    old_enabled = limiter.enabled
    limiter.enabled = False
    old_secret = os.environ.get("JWT_SECRET")
    os.environ["JWT_SECRET"] = JWT_SECRET
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.drop_all()
    limiter.enabled = old_enabled
    if old_secret is None:
        os.environ.pop("JWT_SECRET", None)
    else:
        os.environ["JWT_SECRET"] = old_secret


def make_jwt(user_id: int, username: str = "testuser", email: str = "test@example.com") -> str:
    """Create a valid JWT token for testing."""
    payload = {
        "sub": str(user_id),
        "username": username,
        "email": email,
        "exp": datetime.utcnow() + timedelta(days=7),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm="HS256")


def auth_headers(token: str) -> dict:
    """Build Authorization header dict from a JWT token."""
    return {"Authorization": f"Bearer {token}"}
