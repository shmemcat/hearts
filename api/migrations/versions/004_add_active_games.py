"""Add active_games table

Revision ID: 004
Revises: 003
Create Date: 2026-02-19

"""

from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "active_games",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.String(64), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("difficulty", sa.String(16), nullable=False, server_default="easy"),
        sa.Column("state_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        op.f("ix_active_games_game_id"), "active_games", ["game_id"], unique=True
    )
    op.create_index(
        op.f("ix_active_games_user_id"), "active_games", ["user_id"], unique=False
    )


def downgrade():
    op.drop_index(op.f("ix_active_games_user_id"), table_name="active_games")
    op.drop_index(op.f("ix_active_games_game_id"), table_name="active_games")
    op.drop_table("active_games")
