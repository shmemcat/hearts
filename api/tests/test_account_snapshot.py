import pytest
from sqlalchemy import create_engine

from hearts.account_snapshot import snapshot, verify


def test_snapshot_detects_data_loss_but_allows_additive_migration():
    engine = create_engine("sqlite://")
    with engine.begin() as connection:
        connection.exec_driver_sql(
            "CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, password_hash TEXT)"
        )
        connection.exec_driver_sql(
            "INSERT INTO users VALUES (42, 'existing', 'unchanged-private-hash')"
        )
        before = snapshot(connection)
        assert "unchanged-private-hash" not in str(before)
        connection.exec_driver_sql(
            "ALTER TABLE users ADD COLUMN auth_version INTEGER DEFAULT 0"
        )
        verify(connection, before)
        connection.exec_driver_sql(
            "UPDATE users SET password_hash='changed' WHERE id=42"
        )
        with pytest.raises(RuntimeError, match="users"):
            verify(connection, before)
