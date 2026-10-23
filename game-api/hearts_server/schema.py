"""Explicit, additive Hearts migrations; workers never migrate on startup."""

from pathlib import Path
import sys

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import SQLAlchemyError

from hearts_server.extensions import db

REVISION = "hearts_001"


def schema_ready():
    from hearts_server.game_accounts import receipts, versions, _legacy_games

    try:
        inspector = inspect(db.engine)
        tables = [*db.metadata.sorted_tables, receipts["hearts"], versions["hearts"]]
        if not {table.name for table in tables} | {"hearts_alembic_version"} <= set(
            inspector.get_table_names()
        ):
            return False
        for table in tables:
            if not set(table.columns.keys()) <= {
                column["name"] for column in inspector.get_columns(table.name)
            }:
                return False
        return (
            db.session.execute(
                text("SELECT version_num FROM hearts_alembic_version")
            ).scalar()
            == REVISION
            and db.session.execute(select(versions["hearts"].c.version)).scalar()
            == "game_accounts_001"
            and not _legacy_games()
        )
    except (SQLAlchemyError, ValueError, TypeError, AttributeError):
        db.session.rollback()
        return False


def upgrade_schema():
    config = Config()
    config.set_main_option(
        "script_location", str(Path(__file__).resolve().parent.parent / "migrations")
    )
    with db.engine.begin() as connection:
        if connection.dialect.name == "postgresql":
            connection.execute(text("SELECT pg_advisory_xact_lock(61349201004)"))
        config.attributes["connection"] = connection
        command.upgrade(config, "head")


if __name__ == "__main__":
    from hearts_server import create_app

    app = create_app()
    with app.app_context():
        if sys.argv[1:] == ["upgrade"]:
            upgrade_schema()
        elif sys.argv[1:] == ["check"]:
            raise SystemExit(0 if schema_ready() else 1)
        else:
            raise SystemExit("Use upgrade or check")
