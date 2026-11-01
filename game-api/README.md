# Standalone Hearts game server

This is the production Hearts runtime. `../api` retains the combined compatibility artifact and frozen legacy migrations through `019`. The default root `npm run dev` delegates to the sibling Cards split stack. Never point both runtimes at active Hearts games.

The game package owns five tables (`active_games`, `user_stats`, `user_preferences`, `difficulty_stats`, `game_results`), persistent deletion receipts, and `/game`, `/lobby`, `/multi` Socket.IO namespaces. It has no account endpoints, account ORM, Euchre code, JWT signing secret, password library, or mail dependency. Cookies and supported legacy credentials are validated by the private Cards accounts contract; leaderboards fetch public profiles through that contract.

## Configuration

- `DATABASE_URL` is mandatory. There is no developer database fallback. Use a runtime role restricted to Hearts-owned tables after migrations.
- `CARDS_PUBLIC_URL` is the shared public origin (HTTPS, or localhost HTTP for tests).
- `CARDS_ACCOUNTS_URL`, `CARDS_SERVICE_ID=hearts-game`, `CARDS_SERVICE_TOKEN` configure the private accounts peer. Grant only `sessions.validate` and `profiles.read`.
- `CARDS_GAME_ACCOUNT_TOKENS` is JSON with a separate `hearts` callback key (at least 32 characters), known to the accounts deletion coordinator.
- `CORS_ORIGINS`, `TRUSTED_PROXY_HOPS` retain existing origin/proxy behavior. `ADMIN_KEY` protects the existing monthly achievement job.

Use `uv sync --locked --extra dev`, then `uv run --locked --extra dev pytest -q`. Tests allow only memory or pytest-owned disposable SQLite files. They refuse external databases before opening a connection.

## Schema preparation and startup

Provision Cards accounts first. Using the migration role, explicitly run `python -m hearts_server.schema upgrade`. This additive migration has its own `hearts_alembic_version=hearts_001`; it preserves actual account foreign keys without loading an account model. Existing Hearts tables require verified legacy revision `019` and compatible columns/constraints. Reused phase-three cleanup receipts remain intact. It never recreates or replaces records and refuses destructive downgrades.

Drain legacy multiplayer snapshots lacking `account_links_version=1` before switching ownership. Their identity links cannot be reconstructed safely from names. Readiness rejects them without editing their contents.

Then start `gunicorn -c gunicorn_conf.py hearts_server.wsgi:app` (one eventlet worker on port 5001). Startup performs no DDL. `/health` reports component/version/revision; `/ready` checks the Hearts schema and legacy drain requirement. Accounts downtime is reported as a retryable error, while already connected guests can continue. Signed-in timers pause during an accounts outage and receive a fresh recovery window.

Deletion scrubs saved and live seats, cancels the removed player's timers and credentials, updates remaining players, and resumes bot takeover after the cleanup commit. It also resolves a pending pass when the remaining humans have already submitted. First-match multiplayer statistics are initialized before scoring so a new account receives its result and achievements.

Waiting-lobby seats allow two minutes to reconnect before removal. Host controls
pass to the next member when the host leaves or their reconnect grace expires.
The lobby closes when its last person has been disconnected for two minutes.
Started multiplayer games have no inactivity or disconnect deadline and are not
deleted for having old progress. Reconnecting restores the player's private
state. A missed game-start event is sent again when reconnecting.
Conceding replaces the player with a bot while at least two humans remain. Once
only one human remains, the game and lobby close without counting the unfinished
match as completed. Completed account results remain saved.

Only completed games count toward games played, win rates, score statistics, and
win streaks. Conceding or abandoning a solo or multiplayer game does not count as
a loss or interrupt a streak; already-earned moon shots and achievements remain.

Night Owl uses a game start from midnight through just before 5 a.m.; Early Bird
uses 5 a.m. through just before 8 a.m., in the player's local time. Multiplayer
clients send `utc_offset_minutes` on the `/multi` connection. Each seat retains
its first offset in the saved game, so reconnecting does not change it. The server
awards time and holiday badges when recording the completed game. The compact
completion receipt retains its start date and offset for result-save retries.
Seats without a known offset cannot earn these calendar badges.
Solo clients send the offset when starting a game; its saved state retains that
offset across resumes and daylight-saving changes. Older solo saves continue to
use the offset supplied when recording the result.

## Storage retention

The game worker compacts completed, conceded, and cancelled snapshots after
24 hours, checking at startup and hourly in batches of 200. Unfinished games have
no age limit. Cards, deal history, random-generator state, and seat credentials
are removed; final scores, round score totals, start metadata, and small closed-ID
receipts remain. Existing result logs, statistics, leaderboard history, and
achievements are retained. Completion receipts and statistics commit together,
so result retries after a worker restart cannot count a game twice. Cancelled
games cannot be recorded later as completed games.

This uses the existing schema and runtime grants. Tests disable the maintenance
worker by default; `START_STORAGE_CLEANUP=False` disables it explicitly. The
application's `cleanup_storage` extension invokes the same sweep for maintenance.

Build with context `game-api/`. The build-only `game-server-checks.yml` checks this package without sibling checkouts. The separate `game-release.yml` publishes only `hearts-game-api` for `game-vMAJOR.MINOR.PATCH` tags, with an overwrite check and a digest/source/schema release record. It does not publish `latest`. The retained legacy workflow is [manual-only](../docs/legacy-releases.md). Cards' default local stack and pinned-image integration workflow exercise all three independent services; see [component releases](../../cards/docs/component-releases.md). Cards' `npm run test:postgres` passes with split containers, restricted PostgreSQL roles, and a synthetic legacy backup/restore that preserves seeded record fingerprints through repeated migrations. Production cutover and encrypted offsite Cards recovery are complete; these development/release-policy changes preserve current production pins and guarded rollback.

## Source continuity

Hearts engine, AI, runners, and handlers originate from this repository's combined server at `v5.0.2` (`a28ebaf470a94aee611040af03bc0be4c6000aa6`), with the local account-interface and recovery changes from phases 1–3. The combined copy is deliberately retained for deployment compatibility for guarded rollback and explicit compatibility work.

## Game creation limits

Each account can have 20 unfinished games per app, counting bot and multiplayer
games together. Finished, conceded, and closed games stop counting immediately.
New game/lobby creation allows five per minute per player. Joining and starting
check available space again; rematches also respect the allowance. Resume, moves,
result saves, and concessions remain available at the limit. Waiting lobbies do
not count as unfinished games. `MAX_IN_PROGRESS_GAMES` and
`GAME_CREATIONS_PER_MINUTE` configure these defaults for this single worker.
Guest browser identities apply where games are server-owned; Euchre guest bot
saves stay in the browser and have their own browser allowance.
