# Hearts API

Flask/SQLAlchemy API for Hearts gameplay, accounts, statistics, and preferences.
It also supplies shared Cards accounts for the hub and Euchre.

## Application entrypoints

The independent Hearts-only runtime now lives in [game-api](../game-api/README.md), with its own dependencies, game models, migration version, image context, and tests. This directory retains the combined deployment and its legacy migration history during the transition.

`hearts:app` remains the combined deployment entrypoint. It creates one server
with the existing routes, namespaces, configuration defaults, and migration chain.

`hearts.create_app(config=None, *, role="combined", accounts=None)` also supports
explicit `accounts`, `hearts`, and `euchre` roles for composition and tests. Each
app owns its live game state, socket server, and rate-limit counters. Use the
originating app's context when calling runtime helpers directly. The default
account adapter uses the existing local database and session implementation;
alternate adapters implement `hearts.account_contracts.Accounts`.

The smaller roles are not independent deployments yet. Routing, databases,
credentials, and release workflows remain shared. See the Cards repo's
`docs/account-interface-v1.md` for the contract, compatibility inventory, and
remaining extraction work.

## Configuration

- `DATABASE_URL`: existing Hearts PostgreSQL connection string in production.
- `JWT_SECRET`: retain the existing long signing secret for legacy compatibility.
- `CORS_ORIGINS`: comma-separated allowed public origins.
- `FRONTEND_URL`: origin for legacy verification/recovery links.
- `SMTP2GO_API_KEY`, `SMTP2GO_FROM_EMAIL`: existing SMTP2GO REST provider and
  verified sender. `MAIL_SERVER` and other SMTP settings are not used.
- `CARDS_PUBLIC_URL`: hub origin. Blank disables the shared API. Use
  `http://localhost:3000` locally or `https://cards.shmem.dev` publicly. HTTPS is
  required except on localhost/127.0.0.1; paths and credentials are rejected.
- `CARDS_EMAIL_TRANSPORT`: `smtp2go` (default), or `file` for local tests only.
- `CARDS_EMAIL_OUTBOX`: local sandbox directory for file delivery.

Verification and recovery emails use the shared Cards branding and a centered
layout with Soft slate colors by default. Supporting clients switch to the
Midnight palette with `prefers-color-scheme`; Outlook's recoloring hooks are also
included. Clients that force their own dark colors may override the palette.
The default layout and colors are inline so the emails remain usable when a
client strips the style block. No remote fonts or images are required.

## Shared account endpoints

Mount the API behind `/api/`, stripping that prefix at the proxy.

- `GET /account/session`: user (or null) and CSRF token, with no-store.
- `POST /account/login`: username or email and password; rotates the cookie.
- `POST /account/logout`: revokes login and rotates to a guest session.
- `POST /account/register`: creates an unverified user and sends a link.
- `POST /account/verify-email`: consumes a verification token.
- `POST /account/resend-verification`: requests another verification link.
- `POST /account/forgot-password`: requests a one-hour recovery link.
- `POST /account/reset-password`: consumes a token and revokes existing logins.

All POSTs require Origin and X-CSRF-Token from the session response. Cookies are
HttpOnly, host-only, SameSite=Lax, Path=/, and Secure on HTTPS. Session identifiers
and new email tokens are hashed at rest. Account bodies are limited to 16 KiB and
routes are rate limited. SMTP2GO delivery uses a bounded worker queue to keep
provider latency out of recovery responses. Monitor mail errors; failed or
interrupted delivery can be requested again.

Existing `/login`, `/register`, `/verify-email`, `/forgot-password`,
`/reset-password`, and bearer APIs remain compatible. `/me` and game/profile APIs
accept the shared cookie or a valid legacy JWT. Cookie mutations also require
CSRF. Reset invalidates old shared sessions and JWTs, including multiplayer JWTs.

## Local development

The Cards repo's `npm run dev:accounts` starts this API with a separate, fresh
**Cards/.local/accounts.sqlite** database and localhost URLs. It reuses the API
Python environment and only mail configuration from Hearts' root `.env`; it does
not import production database credentials.

For the PostgreSQL/Docker workflow:

```powershell
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
docker compose exec api flask db upgrade
```

The API is exposed on port 5001. Point hub and game proxies at that one API instead
of running the SQLite runner alongside it.

## Migrations and live users

Back up and test a restored copy before deploying. Run `flask db upgrade` using
the existing live configuration. Migration **017** adds `users.auth_version`
default 0 and `account_sessions`; it leaves users, hashes, profiles, games, and
stats intact. Never replace live with the development database. Further cutover
notes are in the Cards repo's `docs/integration.md`.

## Account tests

Run the backend suite from `api/`:

```powershell
python -m pytest tests/test_shared_accounts.py tests/test_auth_routes.py -q
```

Tests cover identity/stats preservation, migration upgrade/downgrade, CSRF,
cookies, rotation/expiry, shared logout, legacy compatibility, verification, and
reset expiry/replay/revocation. They use isolated data and local mail, not live
accounts or real email delivery.

The pytest configuration overrides inherited database settings before importing
the default application. HTTP/socket fixtures pass an explicit in-memory URL
to the application factory before the database engine is initialized, and
dispose that database after each test without dropping developer tables.
A test-only SQLAlchemy guard also rejects network databases and file databases
outside pytest's temporary directory before the driver opens a connection. It
checks already-pooled connections before SQL execution as well. These checks
use the actual connection target, not mutable Flask configuration, and remain
active for collection and fixture teardown. Migration tests may create SQLite
files only within pytest's temporary directory.

`python -m pytest tests/test_database_safety.py -q` verifies that an inherited
developer-database URL leaves a seeded database unchanged, an unsafe file is
never opened, pooled connections cannot bypass the boundary, and a network
driver is never called. The separate Cards development runner continues using
`Cards/.local/accounts.sqlite`; tests must never use either real development
database.

## Optional remote Cards account owner

The default combined entrypoint and startup migrations remain unchanged. Phase 3
adds an opt-in `CARDS_ACCOUNTS_URL` adapter and fixed public account relay; no
production service is switched automatically. Configure private service/callback
keys, provision supplemental game receipts explicitly, and drain legacy games
before activation. The sibling Cards repository documents the account-owned
schema, runtime grants, deletion/retry policy, and activation order in
`docs/accounts-service.md`. The independent account package is `cards/api/`.

`tests/test_remote_accounts.py` checks private contracts, stale-write fencing,
snapshot cleanup, and outage recovery. Cards' `npm run test:accounts` exercises
actual HTTP and JavaScript Socket.IO clients against separate disposable
account/game processes and rejects game SQL reads of account-owned tables.
