"""Seed per-difficulty stats rows (hard, harder, hardest) from aggregated my_mom rows.

Copies existing my_mom DifficultyStats into 'hard' category per user.
Creates empty 'harder' and 'hardest' rows so per-difficulty tracking starts immediately.

Revision ID: 014
Revises: 013
Create Date: 2026-03-03

"""

from alembic import op

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade():
    # Copy existing my_mom aggregate into 'hard' for each user
    op.execute(
        """
        INSERT INTO difficulty_stats
            (user_id, category, games_played, games_won, moon_shots,
             best_score, worst_score, total_points,
             current_win_streak, max_win_streak)
        SELECT
            user_id, 'hard', games_played, games_won, moon_shots,
            best_score, worst_score, total_points,
            current_win_streak, max_win_streak
        FROM difficulty_stats
        WHERE category = 'my_mom'
        """
    )

    # Create empty 'harder' rows
    op.execute(
        """
        INSERT INTO difficulty_stats
            (user_id, category, games_played, games_won, moon_shots,
             best_score, worst_score, total_points,
             current_win_streak, max_win_streak)
        SELECT
            user_id, 'harder', 0, 0, 0, NULL, NULL, 0, 0, 0
        FROM difficulty_stats
        WHERE category = 'my_mom'
        """
    )

    # Create empty 'hardest' rows
    op.execute(
        """
        INSERT INTO difficulty_stats
            (user_id, category, games_played, games_won, moon_shots,
             best_score, worst_score, total_points,
             current_win_streak, max_win_streak)
        SELECT
            user_id, 'hardest', 0, 0, 0, NULL, NULL, 0, 0, 0
        FROM difficulty_stats
        WHERE category = 'my_mom'
        """
    )


def downgrade():
    op.execute(
        "DELETE FROM difficulty_stats WHERE category IN ('hard', 'harder', 'hardest')"
    )
