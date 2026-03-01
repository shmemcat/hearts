"""Add updated_at column to active_games for stale game cleanup

Revision ID: 013
Revises: 012
Create Date: 2026-03-01

"""

from alembic import op
import sqlalchemy as sa

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "active_games",
        sa.Column("updated_at", sa.DateTime, nullable=True),
    )


def downgrade():
    op.drop_column("active_games", "updated_at")
