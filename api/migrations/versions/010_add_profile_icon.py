"""Add profile_icon column to users table

Revision ID: 010
Revises: 009
Create Date: 2026-02-25

"""

from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column(
            "profile_icon",
            sa.String(64),
            nullable=False,
            server_default="user",
        ),
    )


def downgrade():
    op.drop_column("users", "profile_icon")
