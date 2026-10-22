"""Read-only fingerprints for verifying an existing database across migration.

Usage: python -m hearts.account_snapshot snapshot > before.json
       python -m hearts.account_snapshot verify - < before.json
No usernames, emails, passwords, tokens, or database credentials are output.
"""

import hashlib
import json
import sys
from datetime import date, datetime

import sqlalchemy as sa
from hearts import app
from hearts.extensions import db

TABLES = (
    "users",
    "user_stats",
    "user_preferences",
    "difficulty_stats",
    "game_results",
    "active_games",
    "password_reset_tokens",
)


def fingerprint(connection, name, columns=None):
    table = sa.Table(name, sa.MetaData(), autoload_with=connection)
    names = columns or [column.name for column in table.columns]
    selected = [table.c[name] for name in names]
    order = list(table.primary_key.columns) or selected
    digest, count = hashlib.sha256(), 0
    for row in connection.execute(sa.select(*selected).order_by(*order)):
        values = [
            value.isoformat() if isinstance(value, (date, datetime)) else value
            for value in row
        ]
        digest.update(
            json.dumps(
                values, ensure_ascii=True, separators=(",", ":"), default=str
            ).encode()
        )
        digest.update(b"\n")
        count += 1
    return {"columns": names, "rows": count, "sha256": digest.hexdigest()}


def snapshot(connection):
    available = set(sa.inspect(connection).get_table_names())
    if "users" not in available:
        raise RuntimeError("The existing users table is missing.")
    return {
        "format": 1,
        "tables": {
            name: fingerprint(connection, name) for name in TABLES if name in available
        },
    }


def verify(connection, previous):
    if previous.get("format") != 1 or "users" not in previous.get("tables", {}):
        raise ValueError("Invalid account snapshot.")
    changed = []
    for name, original in previous["tables"].items():
        if (
            name not in TABLES
            or fingerprint(connection, name, original["columns"]) != original
        ):
            changed.append(name)
    if changed:
        raise RuntimeError("Existing records changed: " + ", ".join(changed))


if __name__ == "__main__":
    with app.app_context(), db.engine.connect() as connection:
        if sys.argv[1:] == ["snapshot"]:
            print(json.dumps(snapshot(connection), indent=2))
        elif sys.argv[1:] == ["verify", "-"]:
            verify(connection, json.load(sys.stdin))
            print(
                "All existing account and game records match the pre-migration snapshot."
            )
        else:
            raise SystemExit(__doc__)
