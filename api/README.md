# Hearts API

Flask/SQLAlchemy API for Hearts gameplay, accounts, statistics, and preferences.
It also supplies shared Cards accounts for the hub and Euchre.

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

Set the test database before importing the app:

```powershell
$env:DATABASE_URL='sqlite://'
python -m pytest tests/test_shared_accounts.py tests/test_auth_routes.py -q
```

Tests cover identity/stats preservation, migration upgrade/downgrade, CSRF,
cookies, rotation/expiry, shared logout, legacy compatibility, verification, and
reset expiry/replay/revocation. They use isolated data and local mail, not live
accounts or real email delivery.
