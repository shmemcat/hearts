"""Add better_with_friends achievement column

Revision ID: 015
Revises: 014
Create Date: 2026-03-03

"""

from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "user_stats",
        sa.Column(
            "better_with_friends",
            sa.Boolean,
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade():
    op.drop_column("user_stats", "better_with_friends")
