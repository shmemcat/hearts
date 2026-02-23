"""Add multiplayer support: is_multiplayer + lobby_code on active_games

Revision ID: 008
Revises: 007
Create Date: 2026-02-23

"""

from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "active_games",
        sa.Column(
            "is_multiplayer",
            sa.Boolean(),
            nullable=False,
            server_default="0",
        ),
    )
    op.add_column(
        "active_games",
        sa.Column("lobby_code", sa.String(10), nullable=True),
    )
    op.create_index(
        op.f("ix_active_games_lobby_code"),
        "active_games",
        ["lobby_code"],
        unique=False,
    )


def downgrade():
    op.drop_index(op.f("ix_active_games_lobby_code"), table_name="active_games")
    op.drop_column("active_games", "lobby_code")
    op.drop_column("active_games", "is_multiplayer")
