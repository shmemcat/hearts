"""Add game_results table and leaderboard achievement columns

Revision ID: 011
Revises: 010
Create Date: 2026-02-25

"""

from alembic import op
import sqlalchemy as sa
from datetime import datetime

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "game_results",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False, index=True
        ),
        sa.Column("difficulty", sa.String(16), nullable=False, index=True),
        sa.Column("won", sa.Boolean, nullable=False, default=False),
        sa.Column("completed_at", sa.DateTime, nullable=False, default=datetime.utcnow),
    )

    op.add_column(
        "user_stats",
        sa.Column(
            "monthly_star", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
    )
    op.add_column(
        "user_stats",
        sa.Column(
            "hall_of_fame", sa.Boolean, nullable=False, server_default=sa.text("false")
        ),
    )

    # Backfill: seed GameResult rows from existing aggregate stats so the
    # monthly leaderboard is not empty at launch.
    conn = op.get_bind()

    # easy / medium / multiplayer from difficulty_stats
    rows = conn.execute(
        sa.text(
            "SELECT user_id, category, games_won FROM difficulty_stats WHERE games_won > 0"
        )
    ).fetchall()

    cat_to_diff = {"easy": "easy", "medium": "medium", "multiplayer": "multiplayer"}
    now = datetime.utcnow()
    for user_id, category, games_won in rows:
        diff = cat_to_diff.get(category)
        if not diff:
            continue
        for _ in range(games_won):
            conn.execute(
                sa.text(
                    "INSERT INTO game_results (user_id, difficulty, won, completed_at) "
                    "VALUES (:uid, :diff, true, :ts)"
                ),
                {"uid": user_id, "diff": diff, "ts": now},
            )

    # hard / harder / hardest from user_stats
    hard_rows = conn.execute(
        sa.text(
            "SELECT user_id, hard_wins, harder_wins, hardest_wins FROM user_stats "
            "WHERE hard_wins > 0 OR harder_wins > 0 OR hardest_wins > 0"
        )
    ).fetchall()

    for user_id, hard_wins, harder_wins, hardest_wins in hard_rows:
        for diff, count in [
            ("hard", hard_wins),
            ("harder", harder_wins),
            ("hardest", hardest_wins),
        ]:
            for _ in range(count):
                conn.execute(
                    sa.text(
                        "INSERT INTO game_results (user_id, difficulty, won, completed_at) "
                        "VALUES (:uid, :diff, true, :ts)"
                    ),
                    {"uid": user_id, "diff": diff, "ts": now},
                )


def downgrade():
    op.drop_column("user_stats", "hall_of_fame")
    op.drop_column("user_stats", "monthly_star")
    op.drop_table("game_results")
