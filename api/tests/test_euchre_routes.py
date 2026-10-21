"""Bot leaderboards contain only real account-owned Euchre results."""

from datetime import datetime

import pytest

from tests.test_shared_accounts import accounts, existing_user, post, sign_in

NOW = datetime(2026, 10, 21, 12)


@pytest.fixture(autouse=True)
def fixed_time(monkeypatch):
    import hearts.euchre_routes as routes

    class Clock(datetime):
        @classmethod
        def utcnow(cls):
            return NOW

    monkeypatch.setattr(routes, "datetime", Clock)


def result(game_id="game-1", **changes):
    return dict(
        id=game_id,
        difficulty="easy",
        won=True,
        conceded=False,
        scores=[10, 5],
        finishedAt="2026-10-21T11:00:00.000Z",
        **changes,
    )


def board(client, category="easy"):
    return client.get(
        "/account/euchre/leaderboard", query_string={"category": category}
    )


def test_guests_cannot_submit_results(accounts, existing_user):
    response = post(accounts, "euchre/results", {"results": [result()]})
    assert response.status_code == 401
    assert board(accounts).json == {"monthly": [], "all_time": []}
    from hearts.models import EuchreGameResult

    assert EuchreGameResult.query.count() == 0


def test_upload_requires_csrf_and_preserves_hearts_stats(accounts, existing_user):
    from hearts.models import EuchreGameResult, UserStats, GameResult

    sign_in(accounts)
    assert (
        accounts.post(
            "/account/euchre/results", json={"results": [result()]}
        ).status_code
        == 403
    )
    saved = post(accounts, "euchre/results", {"results": [result()]})
    assert saved.status_code == 200
    assert saved.json["saved_ids"] == ["game-1"]
    assert EuchreGameResult.query.one().user_id == 42
    assert UserStats.query.filter_by(user_id=42).one().games_won == 3
    assert GameResult.query.count() == 0
    assert board(accounts).json["all_time"] == [
        dict(rank=1, username="existing_hearts", profile_icon="user", games_won=1)
    ]
    assert board(accounts).headers["Cache-Control"] == "no-store"


def test_retries_do_not_double_count_or_rewrite_results(accounts, existing_user):
    from hearts.models import EuchreGameResult

    sign_in(accounts)
    data = {"results": [result()]}
    assert post(accounts, "euchre/results", data).status_code == 200
    assert post(accounts, "euchre/results", data).status_code == 200
    edited = result()
    edited["scores"] = [11, 5]
    assert (
        post(
            accounts, "euchre/results", {"results": [result("new-game"), edited]}
        ).status_code
        == 409
    )
    assert EuchreGameResult.query.count() == 1
    assert board(accounts).json["all_time"][0]["games_won"] == 1


@pytest.mark.parametrize(
    "changes",
    [
        {"difficulty": "multiplayer"},
        {"difficulty": []},
        {"scores": [9, 8]},
        {"scores": [10, 10]},
        {"scores": [14, 5]},
        {"scores": [True, 5]},
        {"won": False},
        {"conceded": True},
        {"finishedAt": "not-a-date"},
        {"finishedAt": "2026-10-22T12:00:00Z"},
        {"finishedAt": "2026-10-21T11:00:00"},
    ],
)
def test_invalid_or_incomplete_games_are_rejected(accounts, existing_user, changes):
    from hearts.models import EuchreGameResult

    sign_in(accounts)
    game = result()
    game.update(changes)
    assert (
        post(
            accounts, "euchre/results", {"results": [result("valid-first"), game]}
        ).status_code
        == 400
    )
    assert EuchreGameResult.query.count() == 0


def test_monthly_and_all_time_rank_actual_wins_by_category(accounts, existing_user):
    from hearts.models import User
    from hearts.extensions import db

    sign_in(accounts)
    games = [
        result("easy-current"),
        result("easy-old"),
        result("hard-win"),
        result("loss"),
        result("conceded"),
    ]
    games[1]["finishedAt"] = "2026-09-30T23:59:59Z"
    games[2]["difficulty"] = "hardest"
    games[3].update(won=False, scores=[5, 10])
    games[4].update(won=False, conceded=True, scores=[3, 4])
    assert post(accounts, "euchre/results", {"results": games}).status_code == 200
    assert board(accounts).json["monthly"][0]["games_won"] == 1
    assert board(accounts).json["all_time"][0]["games_won"] == 2
    assert board(accounts, "hardest").json["all_time"][0]["games_won"] == 1
    assert board(accounts, "hard").json["all_time"] == []
    other = User(
        username="another_player",
        email="another@example.test",
        email_verified=True,
        password_hash=existing_user.password_hash,
        profile_icon="cat",
    )
    db.session.add(other)
    db.session.commit()
    sign_in(accounts, "another_player")
    assert (
        post(
            accounts,
            "euchre/results",
            {"user_id": 42, "results": [result("other-1"), result("other-2")]},
        ).status_code
        == 200
    )
    ranked = board(accounts).json["monthly"]
    assert [(row["username"], row["games_won"]) for row in ranked] == [
        ("another_player", 2),
        ("existing_hearts", 1),
    ]
    assert ranked[0]["profile_icon"] == "cat"
    assert set(ranked[0]) == {"username", "rank", "profile_icon", "games_won"}


def test_public_boards_are_top_ten_with_deterministic_ties(accounts):
    from hearts.models import EuchreGameResult, User
    from hearts.extensions import db

    for index in reversed(range(12)):
        user = User(
            username=f"player_{index:02}",
            email=f"p{index}@example.test",
            email_verified=True,
            password_hash="unused",
        )
        db.session.add(user)
        db.session.flush()
        db.session.add(
            EuchreGameResult(
                user_id=user.id,
                game_id=f"g{index}",
                difficulty="easy",
                won=True,
                conceded=False,
                score=10,
                opponent_score=5,
                completed_at=NOW,
            )
        )
    db.session.commit()
    rows = board(accounts).json["all_time"]
    assert len(rows) == 10
    assert [row["username"] for row in rows] == [
        f"player_{index:02}" for index in range(10)
    ]
    assert [row["rank"] for row in rows] == list(range(1, 11))


def test_account_deletion_removes_its_euchre_rankings(accounts, existing_user):
    from tests.test_shared_accounts import EXISTING_USER_PASSWORD
    from hearts.models import EuchreGameResult

    sign_in(accounts)
    post(accounts, "euchre/results", {"results": [result()]})
    assert (
        post(accounts, "delete", {"password": EXISTING_USER_PASSWORD}).status_code
        == 200
    )
    assert EuchreGameResult.query.count() == 0
    assert board(accounts).json["all_time"] == []


def test_multiplayer_remains_empty_and_unknown_categories_fail(accounts):
    assert board(accounts, "multiplayer").json == {"monthly": [], "all_time": []}
    assert board(accounts, "unknown").status_code == 400


def test_result_migration_preserves_existing_accounts():
    import importlib.util
    from pathlib import Path
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, inspect, text

    source = (
        Path(__file__).parents[1] / "migrations/versions/018_add_euchre_game_results.py"
    )
    spec = importlib.util.spec_from_file_location("euchre_result_migration", source)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.execute(
            text("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT)")
        )
        connection.execute(text("INSERT INTO users VALUES (42, 'existing_account')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
        schema = inspect(connection)
        assert "euchre_game_results" in schema.get_table_names()
        assert schema.get_unique_constraints("euchre_game_results")[0][
            "column_names"
        ] == ["user_id", "game_id"]
        assert (
            connection.execute(
                text("SELECT username FROM users WHERE id = 42")
            ).scalar()
            == "existing_account"
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.downgrade()
        assert "euchre_game_results" not in inspect(connection).get_table_names()
        assert connection.execute(text("SELECT COUNT(*) FROM users")).scalar() == 1
