#!/bin/sh
set -e

echo "Waiting for database..."
python -c "
import time, os, psycopg2
url = os.environ['DATABASE_URL']
for i in range(30):
    try:
        psycopg2.connect(url)
        break
    except Exception:
        time.sleep(1)
else:
    raise RuntimeError('Database not ready after 30s')
"

echo "Running migrations..."
flask db upgrade

echo "Starting server..."
exec "$@"
