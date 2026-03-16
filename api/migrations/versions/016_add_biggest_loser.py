"""Add biggest_loser achievement column

Revision ID: 016
Revises: 015
Create Date: 2026-03-16

"""

from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_stats",
        sa.Column(
            "biggest_loser",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade():
    op.drop_column("user_stats", "biggest_loser")
