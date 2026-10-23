"""Test-only SQLAlchemy boundaries, independent of Flask's mutable config."""

from contextlib import contextmanager
from pathlib import Path

from sqlalchemy import event
from sqlalchemy.engine import Engine


class UnsafeTestDatabase(RuntimeError):
    pass


def check_database(dialect, database, temporary_root, *, uri=False):
    if dialect != "sqlite":
        raise UnsafeTestDatabase("Tests cannot connect to network databases")
    if database in {None, "", ":memory:"}:
        return
    # URI filenames have additional SQLite semantics. The tests use plain paths.
    if uri or str(database).startswith("file:"):
        raise UnsafeTestDatabase(
            "Test databases require memory or a plain temporary path"
        )
    target = Path(database).resolve()
    root = Path(
        temporary_root() if callable(temporary_root) else temporary_root
    ).resolve()
    if not target.is_relative_to(root):
        raise UnsafeTestDatabase(
            "Test database is outside the pytest temporary directory"
        )


@contextmanager
def database_guard(temporary_root):
    """Reject unsafe connections before DBAPI opens them and check pooled ones."""

    def before_connect(dialect, record, args, kwargs):
        database = args[0] if args else kwargs.get("database")
        check_database(
            dialect.name, database, temporary_root, uri=kwargs.get("uri", False)
        )

    def before_execute(connection, cursor, statement, parameters, context, executemany):
        url = connection.engine.url
        check_database(
            url.get_backend_name(),
            url.database,
            temporary_root,
            uri=str(url.query.get("uri", "false")).lower() == "true",
        )

    event.listen(Engine, "do_connect", before_connect)
    event.listen(Engine, "before_cursor_execute", before_execute)
    try:
        yield
    finally:
        event.remove(Engine, "before_cursor_execute", before_execute)
        event.remove(Engine, "do_connect", before_connect)
