"""Add shared Cards sessions without changing existing users or game records."""

from alembic import op
import sqlalchemy as sa

revision = "017"
down_revision = "016"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("auth_version", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "account_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("csrf_token", sa.String(64), nullable=False),
        sa.Column("credential_hash", sa.String(64)),
        sa.Column("created_at", sa.DateTime, nullable=False),
        sa.Column("last_seen_at", sa.DateTime, nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_account_sessions_user_id", "account_sessions", ["user_id"])
    op.create_index(
        "ix_account_sessions_expires_at", "account_sessions", ["expires_at"]
    )


def downgrade():
    op.drop_table("account_sessions")
    op.drop_column("users", "auth_version")
