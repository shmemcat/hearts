"""Adopt verified legacy Hearts tables or create only Hearts-owned records."""

from alembic import op
from sqlalchemy import (
    Column,
    ForeignKeyConstraint,
    Integer,
    MetaData,
    Table,
    inspect,
    select,
    text,
)

revision = "hearts_001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    from hearts_server.extensions import db
    from hearts_server import models
    from hearts_server.game_accounts import receipts, versions

    connection = op.get_bind()
    inspector = inspect(connection)
    existing = set(inspector.get_table_names())
    tables = list(db.metadata.sorted_tables)
    if "users" not in existing:
        raise RuntimeError("Provision shared accounts first; Hearts never owns users")
    if {table.name for table in tables} & existing:
        if (
            "alembic_version" not in existing
            or connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar()
            != "019"
        ):
            raise RuntimeError(
                "Existing game tables require verified legacy revision 019"
            )

    migration_metadata = MetaData()
    Table("users", migration_metadata, Column("id", Integer, primary_key=True))
    for table in tables:
        if table.name in existing:
            columns = {
                column["name"]: column for column in inspector.get_columns(table.name)
            }
            if not set(table.columns.keys()) <= columns.keys():
                raise RuntimeError(
                    f"Incompatible {table.name} columns; no data was replaced"
                )
            for column in table.columns:
                actual = columns[column.name]
                if column.type._type_affinity is not actual["type"]._type_affinity or (
                    not column.nullable
                    and actual["nullable"]
                    and not column.primary_key
                ):
                    raise RuntimeError(
                        f"Incompatible {table.name}.{column.name} type/nullability"
                    )
        else:
            # Account FK metadata exists only during migration, never in the runtime ORM.
            migrated = table.to_metadata(migration_metadata)
            migrated.append_constraint(ForeignKeyConstraint(["user_id"], ["users.id"]))
            migrated.create(connection)

    inspector = inspect(connection)
    expected_unique = {
        "active_games": {("game_id",)},
        "user_stats": {("user_id",)},
        "user_preferences": {("user_id",)},
        "difficulty_stats": {("user_id", "category")},
    }
    for table in tables:
        keys = inspector.get_foreign_keys(table.name)
        if not any(
            key["constrained_columns"] == ["user_id"]
            and key["referred_table"] == "users"
            and key["referred_columns"] == ["id"]
            for key in keys
        ):
            raise RuntimeError(f"Verify the shared account foreign key on {table.name}")
        uniques = {
            tuple(key["column_names"])
            for key in inspector.get_unique_constraints(table.name)
        }
        uniques |= {
            tuple(key["column_names"])
            for key in inspector.get_indexes(table.name)
            if key.get("unique")
        }
        if not expected_unique.get(table.name, set()) <= uniques:
            raise RuntimeError(f"Verify uniqueness constraints on {table.name}")

    for table in (receipts["hearts"], versions["hearts"]):
        table.create(connection, checkfirst=True)
        if not set(table.columns.keys()) <= {
            column["name"] for column in inspect(connection).get_columns(table.name)
        }:
            raise RuntimeError("Incompatible account cleanup schema")
    version = connection.execute(select(versions["hearts"].c.version)).scalar()
    if version is None:
        connection.execute(
            versions["hearts"].insert().values(version="game_accounts_001")
        )
    elif version != "game_accounts_001":
        raise RuntimeError("Unsupported account cleanup schema")


def downgrade():
    raise RuntimeError(
        "Preserve games, scores, and deletion receipts; use a forward migration"
    )
