"""Persist Euchre multiplayer tables independently of Hearts games."""

from alembic import op
import sqlalchemy as sa

revision = "019"
down_revision = "018"
branch_labels = None
depends_on = None


def upgrade():
    for name in ("marches", "loners", "euchres"):
        op.add_column(
            "euchre_game_results",
            sa.Column(name, sa.Integer, nullable=False, server_default="0"),
        )
    op.create_table(
        "euchre_tables",
        sa.Column("code", sa.String(6), primary_key=True),
        sa.Column("snapshot", sa.Text, nullable=False),
        sa.Column("updated_at", sa.DateTime, nullable=False),
    )


def downgrade():
    op.drop_table("euchre_tables")
    for name in ("euchres", "loners", "marches"):
        op.drop_column("euchre_game_results", name)
