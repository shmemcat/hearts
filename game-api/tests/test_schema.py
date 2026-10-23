import json

import pytest
from sqlalchemy import inspect, text

from hearts_server.extensions import db
from hearts_server.models import ActiveGame, UserPreferences, UserStats
from hearts_server.schema import schema_ready, upgrade_schema
from tests.conftest import add_profile


def test_fresh_schema_owns_only_hearts_with_actual_account_foreign_keys(app):
    names = set(inspect(db.engine).get_table_names())
    assert names == set(db.metadata.tables) | {
        "users",
        "hearts_account_deletions",
        "hearts_account_schema_version",
        "hearts_alembic_version",
    }
    assert "users" not in db.metadata.tables
    for table in db.metadata.tables:
        assert (
            inspect(db.engine).get_foreign_keys(table)[0]["referred_table"] == "users"
        )
    assert schema_ready()
    upgrade_schema()


@pytest.mark.parametrize("revision", ["019", "018"])
def test_legacy_adoption_retains_scores_preferences_saves_and_receipts(app, revision):
    from hearts_server.game_accounts import receipts

    add_profile(app, 42, "preserved")
    db.session.add(UserPreferences(user_id=42, card_style="flourish"))
    db.session.add(UserStats(user_id=42, games_won=5, moon_shots=3))
    snapshot = '{"account_links_version":1,"preserved":"credentials"}'
    db.session.add(ActiveGame(user_id=42, game_id="preserved", state_json=snapshot))
    db.session.execute(
        receipts["hearts"]
        .insert()
        .values(
            user_id=90,
            request_id="a" * 32,
            deleted_at=__import__("datetime").datetime.utcnow(),
        )
    )
    db.session.execute(text("DROP TABLE hearts_alembic_version"))
    db.session.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
    db.session.execute(
        text("INSERT INTO alembic_version VALUES (:rev)"), {"rev": revision}
    )
    db.session.commit()
    if revision == "018":
        with pytest.raises(RuntimeError, match="019"):
            upgrade_schema()
        assert not schema_ready()
    else:
        upgrade_schema()
        assert schema_ready()
    assert UserStats.query.one().games_won == 5
    assert UserPreferences.query.one().card_style == "flourish"
    assert ActiveGame.query.one().state_json == snapshot
    assert db.session.execute(receipts["hearts"].select()).one().user_id == 90
    assert (
        db.session.execute(text("SELECT version_num FROM alembic_version")).scalar()
        == revision
    )


def test_readiness_requires_legacy_multiplayer_drain_without_editing_saves(app):
    snapshot = '{"seats":[{"name":"Cannot infer identity"}]}'
    db.session.add(
        ActiveGame(game_id="legacy", is_multiplayer=True, state_json=snapshot)
    )
    db.session.commit()
    assert app.test_client().get("/ready").status_code == 503
    assert app.test_client().post("/games/start", json={}).status_code == 503
    assert ActiveGame.query.one().state_json == snapshot


def test_future_schema_is_refused_without_migration(app):
    db.session.execute(
        text("UPDATE hearts_alembic_version SET version_num='hearts_future'")
    )
    db.session.commit()
    assert app.test_client().get("/ready").status_code == 503
    assert app.test_client().get("/health").status_code == 200
    assert (
        db.session.execute(
            text("SELECT version_num FROM hearts_alembic_version")
        ).scalar()
        == "hearts_future"
    )


def test_existing_incompatible_columns_are_refused_without_replacing_data(app):
    db.session.execute(text("DROP TABLE hearts_alembic_version"))
    db.session.execute(text("CREATE TABLE alembic_version (version_num VARCHAR(32))"))
    db.session.execute(text("INSERT INTO alembic_version VALUES ('019')"))
    db.session.execute(text("ALTER TABLE user_stats DROP COLUMN games_won"))
    db.session.execute(text("CREATE TABLE keep_other_service (value TEXT)"))
    db.session.execute(text("INSERT INTO keep_other_service VALUES ('preserve')"))
    db.session.commit()
    with pytest.raises(RuntimeError, match="Incompatible user_stats columns"):
        upgrade_schema()
    assert (
        db.session.execute(text("SELECT value FROM keep_other_service")).scalar()
        == "preserve"
    )


def test_migration_requires_accounts_and_does_not_create_identity_tables(app):
    from hearts_server import create_app

    other = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": "sqlite://",
            "CARDS_PUBLIC_URL": "http://localhost:3000",
            "GAME_ACCOUNT_TOKENS": {"hearts": "c" * 40},
        },
        accounts=app.extensions["accounts"],
    )
    with other.app_context():
        with pytest.raises(RuntimeError, match="shared accounts"):
            upgrade_schema()
        assert set(inspect(db.engine).get_table_names()) <= {"hearts_alembic_version"}
        db.session.remove()
        db.engine.dispose()
