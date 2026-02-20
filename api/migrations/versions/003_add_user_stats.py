"""Add user_stats table

Revision ID: 003
Revises: 002
Create Date: 2026-02-18

"""

from alembic import op
import sqlalchemy as sa

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("moon_shots", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_score", sa.Integer(), nullable=True),
        sa.Column("worst_score", sa.Integer(), nullable=True),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index(
        op.f("ix_user_stats_user_id"), "user_stats", ["user_id"], unique=True
    )


def downgrade():
    op.drop_index(op.f("ix_user_stats_user_id"), table_name="user_stats")
    op.drop_table("user_stats")
