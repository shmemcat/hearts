# Build stage: install UV and dependencies
FROM python:3.11-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

COPY pyproject.toml ./
RUN uv lock \
    && uv sync --locked --no-install-project

# Runtime stage
FROM python:3.11-slim

WORKDIR /app

COPY --from=builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

COPY gunicorn_conf.py ./
COPY hearts ./hearts
COPY migrations ./migrations

EXPOSE 5000

ENTRYPOINT ["./entrypoint.sh"]
CMD ["gunicorn", "-c", "gunicorn_conf.py", "hearts:app"]
