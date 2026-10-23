"""Shared fixtures for hearts engine and API tests."""

import os
import pytest
import jwt as pyjwt
from datetime import datetime, timedelta

# Set this before the lazy default application is created. Changing Flask's
# config after db.init_app cannot replace its already-configured database engine.
# Test runs must never fall back to the developer's instance/hearts.db file.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ.pop("CARDS_ACCOUNTS_URL", None)

from hearts.game.card import (
    Card,
    Suit,
    deck_52,
    shuffle_deck,
    deal_into_4_hands,
    two_of_clubs,
)
from hearts.game.state import GameState, Phase, PassDirection, initial_state_after_deal

JWT_SECRET = "test-secret-key-for-hearts"


def pytest_configure(config):
    from tests.database_safety import database_guard

    # Configure is replayed for conftests discovered after collection starts.
    # Resolve pytest's temporary root only when a file connection is attempted.
    guard = database_guard(lambda: config._tmp_path_factory.getbasetemp())
    guard.__enter__()
    config._hearts_database_guard = guard


def pytest_unconfigure(config):
    guard = getattr(config, "_hearts_database_guard", None)
    if guard is not None:
        guard.__exit__(None, None, None)


@pytest.fixture(scope="session", autouse=True)
def isolated_database_guard():
    """Fail before any test writes if a collection-time import chose another DB."""
    from hearts import app
    from hearts.extensions import db

    with app.app_context():
        if str(db.engine.url) != "sqlite://":
            pytest.fail("Tests require an in-memory default database", pytrace=False)


@pytest.fixture
def default_test_app():
    """Configure the engine before initialization; dispose memory instead of DROP."""
    import hearts
    from hearts.extensions import db

    previous = hearts._default_app
    app = hearts.create_app(
        {
            "TESTING": True,
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "RATELIMIT_ENABLED": False,
            "CARDS_ACCOUNTS_URL": "",
        }
    )
    hearts._default_app = app
    try:
        yield app
    finally:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        hearts._default_app = previous


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
def client(default_test_app):
    """Flask test client for API route tests."""
    from hearts.extensions import db

    app = default_test_app
    with app.app_context():
        db.create_all()
        yield app.test_client()


@pytest.fixture
def auth_client(default_test_app, monkeypatch):
    """Flask test client with JWT_SECRET set and rate limiting disabled for auth tests."""
    from hearts.extensions import db

    app = default_test_app
    monkeypatch.setenv("JWT_SECRET", JWT_SECRET)
    with app.app_context():
        db.create_all()
        yield app.test_client()


def make_jwt(
    user_id: int, username: str = "testuser", email: str = "test@example.com"
) -> str:
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
