"""Add achievement tracking fields to user_stats

Revision ID: 006
Revises: 005
Create Date: 2026-02-22

"""

from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("user_stats") as batch_op:
        batch_op.add_column(
            sa.Column("hard_wins", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("harder_wins", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("hardest_wins", sa.Integer(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column(
                "current_win_streak", sa.Integer(), nullable=False, server_default="0"
            )
        )
        batch_op.add_column(
            sa.Column(
                "max_win_streak", sa.Integer(), nullable=False, server_default="0"
            )
        )
        batch_op.add_column(
            sa.Column("night_owl", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("lucky_seven", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("double_moon", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("geezer", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("wimp", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("early_bird", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("lonely_heart", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("photo_finish", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("demolition", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("speed_demon", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("marathon", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("eclipse", sa.Boolean(), nullable=False, server_default="0")
        )
        batch_op.add_column(
            sa.Column("heartbreaker", sa.Boolean(), nullable=False, server_default="0")
        )


def downgrade():
    with op.batch_alter_table("user_stats") as batch_op:
        batch_op.drop_column("heartbreaker")
        batch_op.drop_column("eclipse")
        batch_op.drop_column("marathon")
        batch_op.drop_column("speed_demon")
        batch_op.drop_column("demolition")
        batch_op.drop_column("photo_finish")
        batch_op.drop_column("lonely_heart")
        batch_op.drop_column("early_bird")
        batch_op.drop_column("wimp")
        batch_op.drop_column("geezer")
        batch_op.drop_column("double_moon")
        batch_op.drop_column("lucky_seven")
        batch_op.drop_column("night_owl")
        batch_op.drop_column("max_win_streak")
        batch_op.drop_column("current_win_streak")
        batch_op.drop_column("hardest_wins")
        batch_op.drop_column("harder_wins")
        batch_op.drop_column("hard_wins")
