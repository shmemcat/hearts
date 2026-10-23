"""Prove misconfiguration cannot clear an existing developer database."""

import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import sys

import pytest
from sqlalchemy import create_engine, text

from tests.database_safety import UnsafeTestDatabase, database_guard


def seed(path):
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE keep_me (value TEXT)")
        connection.execute("INSERT INTO keep_me VALUES ('preserve this row')")


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def test_inherited_developer_database_is_unchanged_by_the_test_runner(tmp_path):
    sentinel = tmp_path / "developer.sqlite"
    seed(sentinel)
    before = digest(sentinel)
    probe = tmp_path / "test_probe.py"
    probe.write_text(
        """
def test_database_is_disposable(client):
    from hearts_server import app
    from hearts_server.extensions import db
    from sqlalchemy import text
    with app.app_context():
        assert str(db.engine.url) == "sqlite://"
        db.session.execute(text("CREATE TABLE only_in_test_memory (value INTEGER)"))
        db.session.commit()
""",
        encoding="utf-8",
    )
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "tests.conftest",
            "-p",
            "no:cacheprovider",
            str(probe),
            "--basetemp",
            str(tmp_path / "child-temp"),
        ],
        cwd=Path(__file__).resolve().parents[1],
        env={
            **os.environ,
            "DATABASE_URL": "sqlite:///" + str(sentinel),
            "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
        },
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert digest(sentinel) == before
    with sqlite3.connect(sentinel) as connection:
        assert connection.execute("SELECT value FROM keep_me").fetchone() == (
            "preserve this row",
        )


def test_guard_rejects_file_connections_before_opening_them(tmp_path):
    protected = tmp_path / "developer.sqlite"
    engine = create_engine("sqlite:///" + str(protected))
    with database_guard(tmp_path / "permitted"):
        with pytest.raises(UnsafeTestDatabase, match="outside"):
            engine.connect()
    assert not protected.exists()
    seed(protected)
    before = digest(protected)
    with database_guard(tmp_path / "permitted"):
        with pytest.raises(UnsafeTestDatabase, match="outside"):
            engine.connect()
    assert digest(protected) == before
    engine.dispose()


def test_guard_also_checks_connections_already_in_a_pool(tmp_path):
    protected = tmp_path / "developer.sqlite"
    seed(protected)
    before = digest(protected)
    engine = create_engine("sqlite:///" + str(protected))
    with engine.connect() as connection:
        with database_guard(tmp_path / "permitted"):
            with pytest.raises(UnsafeTestDatabase, match="outside"):
                connection.execute(text("DROP TABLE keep_me"))
    engine.dispose()
    assert digest(protected) == before


def test_network_database_is_rejected_before_the_driver_connects(monkeypatch):
    engine = create_engine("postgresql+psycopg2://fixture:fixture@127.0.0.1:1/fixture")
    calls = []
    monkeypatch.setattr(
        engine.dialect.dbapi, "connect", lambda *args, **kwargs: calls.append(True)
    )
    with pytest.raises(UnsafeTestDatabase, match="network"):
        engine.connect()
    assert not calls
    engine.dispose()
