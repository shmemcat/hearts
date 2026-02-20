"""Add username to users

Revision ID: 002
Revises: 001
Create Date: 2026-02-15

"""

from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("username", sa.String(length=64), nullable=True))
    # Backfill: unique username from email local part + id (Postgres)
    op.execute(
        "UPDATE users SET username = LOWER(SPLIT_PART(email, '@', 1)) || '_' || id WHERE username IS NULL"
    )
    op.alter_column(
        "users",
        "username",
        existing_type=sa.String(64),
        nullable=False,
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)


def downgrade():
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_column("users", "username")
