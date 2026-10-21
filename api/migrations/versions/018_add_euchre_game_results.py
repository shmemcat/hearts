"""Store Euchre bot results separately from existing Hearts statistics."""

from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "euchre_game_results",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("game_id", sa.String(64), nullable=False),
        sa.Column("difficulty", sa.String(16), nullable=False),
        sa.Column("won", sa.Boolean, nullable=False),
        sa.Column("conceded", sa.Boolean, nullable=False),
        sa.Column("score", sa.Integer, nullable=False),
        sa.Column("opponent_score", sa.Integer, nullable=False),
        sa.Column("completed_at", sa.DateTime, nullable=False),
        sa.Column("recorded_at", sa.DateTime, nullable=False),
        sa.UniqueConstraint(
            "user_id", "game_id", name="uq_euchre_game_result_user_game"
        ),
    )
    op.create_index(
        "ix_euchre_game_results_user_id", "euchre_game_results", ["user_id"]
    )
    op.create_index(
        "ix_euchre_results_category_completed",
        "euchre_game_results",
        ["difficulty", "won", "completed_at"],
    )


def downgrade():
    op.drop_index(
        "ix_euchre_results_category_completed", table_name="euchre_game_results"
    )
    op.drop_index("ix_euchre_game_results_user_id", table_name="euchre_game_results")
    op.drop_table("euchre_game_results")
