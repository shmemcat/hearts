"""Replace multiplayer_stats with difficulty_stats table, migrate existing UserStats to my_mom category

Revision ID: 009
Revises: 008
Create Date: 2026-02-23

"""

from alembic import op
import sqlalchemy as sa

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "difficulty_stats",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("games_played", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("games_won", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("moon_shots", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("best_score", sa.Integer(), nullable=True),
        sa.Column("worst_score", sa.Integer(), nullable=True),
        sa.Column("total_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "current_win_streak", sa.Integer(), nullable=False, server_default="0"
        ),
        sa.Column("max_win_streak", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint(
            "user_id", "category", name="uq_difficulty_stats_user_category"
        ),
    )

    # Migrate existing aggregate stats into the "my_mom" category for backwards compat
    op.execute(
        """
        INSERT INTO difficulty_stats
            (user_id, category, games_played, games_won, moon_shots,
             best_score, worst_score, total_points,
             current_win_streak, max_win_streak)
        SELECT
            user_id, 'my_mom', games_played, games_won, moon_shots,
            best_score, worst_score, total_points,
            current_win_streak, max_win_streak
        FROM user_stats
        WHERE games_played > 0
        """
    )

    # multiplayer_stats table was never created, so no data to migrate
    # Multiplayer category rows will be created as games are played


def downgrade():
    op.drop_table("difficulty_stats")
