"""Add missing achievement columns and drop goose_egg

The 006 migration was stamped in production but only partially applied.
This migration adds the columns that were missing and drops goose_egg.

Revision ID: 007
Revises: 006
Create Date: 2026-02-23

"""

from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def _column_exists(table, column):
    bind = op.get_bind()
    result = bind.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column"
        ),
        {"table": table, "column": column},
    )
    return result.scalar() is not None


def upgrade():
    new_columns = [
        ("wimp", sa.Boolean()),
        ("early_bird", sa.Boolean()),
        ("lonely_heart", sa.Boolean()),
        ("photo_finish", sa.Boolean()),
        ("demolition", sa.Boolean()),
        ("speed_demon", sa.Boolean()),
        ("marathon", sa.Boolean()),
        ("eclipse", sa.Boolean()),
        ("heartbreaker", sa.Boolean()),
    ]
    with op.batch_alter_table("user_stats") as batch_op:
        for col_name, col_type in new_columns:
            if not _column_exists("user_stats", col_name):
                batch_op.add_column(
                    sa.Column(col_name, col_type, nullable=False, server_default="0")
                )
        if _column_exists("user_stats", "goose_egg"):
            batch_op.drop_column("goose_egg")


def downgrade():
    with op.batch_alter_table("user_stats") as batch_op:
        if not _column_exists("user_stats", "goose_egg"):
            batch_op.add_column(
                sa.Column("goose_egg", sa.Boolean(), nullable=False, server_default="0")
            )
        for col_name in reversed(
            [
                "wimp",
                "early_bird",
                "lonely_heart",
                "photo_finish",
                "demolition",
                "speed_demon",
                "marathon",
                "eclipse",
                "heartbreaker",
            ]
        ):
            if _column_exists("user_stats", col_name):
                batch_op.drop_column(col_name)
