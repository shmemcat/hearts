"""Add holiday achievement columns

Revision ID: 012
Revises: 011
Create Date: 2026-02-26

"""

from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None

_COLUMNS = [
    "new_year",
    "lucky_clover",
    "easter_egg",
    "fireworks",
    "spooky",
    "thankful",
    "christmas_spirit",
]


def upgrade():
    for col in _COLUMNS:
        op.add_column(
            "user_stats",
            sa.Column(col, sa.Boolean, nullable=False, server_default=sa.text("false")),
        )


def downgrade():
    for col in reversed(_COLUMNS):
        op.drop_column("user_stats", col)
