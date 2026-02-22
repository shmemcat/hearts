"""Add user_preferences table

Revision ID: 005
Revises: 004
Create Date: 2026-02-21

"""

from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "user_preferences",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "card_style",
            sa.String(20),
            nullable=False,
            server_default="standard",
        ),
        sa.Column(
            "hard_level",
            sa.String(20),
            nullable=False,
            server_default="hard",
        ),
        sa.Column(
            "mobile_layout",
            sa.String(20),
            nullable=False,
            server_default="single",
        ),
    )
    op.create_index(
        op.f("ix_user_preferences_user_id"),
        "user_preferences",
        ["user_id"],
        unique=True,
    )


def downgrade():
    op.drop_index(op.f("ix_user_preferences_user_id"), table_name="user_preferences")
    op.drop_table("user_preferences")
