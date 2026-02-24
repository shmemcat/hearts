# H E A R T S

A full-stack, real-time implementation of the classic Hearts card game with single-player AI, online multiplayer, achievements, and a polished, responsive UI.

**Live at [hearts.shmem.dev](https://hearts.shmem.dev/)**

![CleanShot 2024-02-23 at 19 22 37](https://github.com/shmemcat/hearts/assets/14319144/cca909dc-1068-4f1a-ad17-b64400b8ff52)

## Features

- **Single-player vs. AI** -- four difficulty levels from random play to Monte Carlo simulation
- **Online multiplayer** -- create a lobby, share a code, and play with friends in real time
- **Lobby system** -- host migration, AI backfill for empty seats, spectator mode
- **Achievements** -- 20+ tiered and secret achievements tracked across games
- **User accounts** -- registration with email verification, password reset, persistent stats
- **Sound & music** -- multiple sound variants per action, independent volume controls
- **Animations** -- card dealing, trick-taking, shoot-the-moon celebrations, and confetti
- **Responsive design** -- mobile-optimized game table with touch-friendly card selection
- **Theming & preferences** -- card deck styles, difficulty defaults, layout options

## Tech Stack

### Frontend

| Technology                                                                     | Purpose                           |
| ------------------------------------------------------------------------------ | --------------------------------- |
| [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) | UI framework                      |
| [Vite](https://vite.dev/)                                                      | Build tool and dev server         |
| [Tailwind CSS 4](https://tailwindcss.com/) + CSS Modules                       | Styling                           |
| [React Router 7](https://reactrouter.com/)                                     | Client-side routing               |
| [Socket.IO Client](https://socket.io/)                                         | Real-time WebSocket communication |
| [Framer Motion](https://motion.dev/)                                           | Card and UI animations            |
| [Howler.js](https://howlerjs.com/)                                             | Sound effects and music           |
| [Radix UI](https://www.radix-ui.com/)                                          | Accessible tooltip primitives     |
| [Font Awesome Pro](https://fontawesome.com/)                                   | Icons                             |
| [party-js](https://party.js.org/)                                              | Confetti effects                  |

### Backend

| Technology                                                                                              | Purpose                                                   |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| [Flask](https://flask.palletsprojects.com/)                                                             | REST API framework                                        |
| [Flask-SocketIO](https://flask-socketio.readthedocs.io/) + [Eventlet](https://eventlet.readthedocs.io/) | WebSocket server (3 namespaces: game, lobby, multiplayer) |
| [PostgreSQL 16](https://www.postgresql.org/)                                                            | Persistent storage                                        |
| [SQLAlchemy](https://www.sqlalchemy.org/) + [Flask-Migrate](https://flask-migrate.readthedocs.io/)      | ORM and schema migrations                                 |
| [PyJWT](https://pyjwt.readthedocs.io/)                                                                  | JWT authentication                                        |
| [Argon2](https://argon2-cffi.readthedocs.io/)                                                           | Password hashing                                          |
| [Flask-Limiter](https://flask-limiter.readthedocs.io/)                                                  | Rate limiting                                             |
| [Flask-CORS](https://flask-cors.readthedocs.io/)                                                        | Cross-origin support                                      |

### Infrastructure

| Technology                                                                                             | Purpose                                                   |
| ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| [Docker](https://www.docker.com/) + Docker Compose                                                     | Containerized dev and prod environments                   |
| [Nginx](https://nginx.org/)                                                                            | Reverse proxy and static file serving (production)        |
| [GitHub Actions](https://github.com/features/actions)                                                  | CI/CD -- builds and pushes images to GHCR on version tags |
| [Watchtower](https://containrrr.dev/watchtower/)                                                       | Auto-deploys new images in production                     |
| [Husky](https://typicode.github.io/husky/) + [lint-staged](https://github.com/lint-staged/lint-staged) | Pre-commit formatting and linting                         |

## Architecture

```
┌──────────────┐       WebSocket / REST        ┌──────────────┐
│              │  ◄──────────────────────────►  │              │
│   React SPA  │         (Socket.IO)            │  Flask API   │
│   (Vite)     │                                │  (Eventlet)  │
│              │                                │              │
└──────┬───────┘                                └──────┬───────┘
       │                                               │
       │  Nginx (prod) / Vite proxy (dev)              │  SQLAlchemy
       │  serves static + proxies /api, /socket.io     │
       │                                               ▼
       │                                        ┌──────────────┐
       │                                        │  PostgreSQL   │
       └────────────────────────────────────────┘              │
                                                └──────────────┘
```

The frontend is a single-page app that communicates with the backend over REST (game CRUD, auth, stats) and WebSockets (real-time gameplay). In production, Nginx serves the built SPA and reverse-proxies API and Socket.IO traffic to the Flask container.

## AI Strategy

The game includes four AI difficulty tiers:

| Difficulty              | Strategy                                                                                                                                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Easy                    | Random legal play                                                                                                                                                                                                          |
| Medium                  | Rule-based heuristics (void creation, point avoidance, safe leads)                                                                                                                                                         |
| Hard / Harder / Hardest | **Determinized Monte Carlo** -- samples possible opponent hands consistent with observed play, simulates remaining tricks, and picks the move with the lowest expected score. Higher tiers increase the simulation budget. |

The hard AI tracks opponent voids inferred from trick play and never peeks at hidden cards, ensuring fair play while still providing a strong challenge.

## Multiplayer

Multiplayer uses a lobby-based flow:

1. **Create** a lobby and receive a 6-character room code
2. **Share** the code with friends, who join via the code
3. **Fill** remaining seats with AI at any difficulty
4. **Play** in real time with per-player state views (you only see your own hand)

Additional multiplayer features:

- 120-second reconnect window before auto-concede
- Host migration if the creator disconnects
- Spectator support
- AI takeover on concede

## Getting Started

### Prerequisites

- Docker & Docker Compose v2
- Node.js 20+ (for local frontend dev)
- Python 3.9+ (for local backend dev, managed via [uv](https://docs.astral.sh/uv/))

### Environment Variables

The root `.env` file is read by Docker Compose and configures Postgres, the Flask API, and mail settings. It is never committed (listed in `.gitignore`). The frontend uses a relative `/api` path for all API calls, so no frontend env vars are needed -- in development the Vite dev server proxies `/api` and `/socket.io` to the API container; in production Nginx does the same.

| Variable | Used by | When | Required |
| --- | --- | --- | --- |
| `POSTGRES_USER` | db, api | Runtime | Yes |
| `POSTGRES_PASSWORD` | db, api | Runtime | Yes |
| `POSTGRES_DB` | db, api | Runtime | Yes |
| `JWT_SECRET` | api | Runtime | Yes |
| `CORS_ORIGINS` | api | Runtime | Yes (prod) |
| `FRONTEND_URL` | api | Runtime | Yes (prod) |
| `MAIL_SERVER` | api | Runtime | For email |
| `MAIL_PORT` | api | Runtime | For email |
| `MAIL_USE_TLS` | api | Runtime | For email |
| `MAIL_USERNAME` | api | Runtime | For email |
| `MAIL_PASSWORD` | api | Runtime | For email |
| `MAIL_DEFAULT_SENDER` | api | Runtime | For email |
| `FONTAWESOME_PACKAGE_TOKEN` | web | Build-time | Yes |

### Development

1. Clone the repo and copy the example environment file (defaults work for local dev):

   ```bash
   git clone https://github.com/shmemcat/hearts.git
   cd hearts
   cp .env.example .env
   ```

2. Start the full stack with hot reload:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up
   ```

   - Frontend: http://localhost:3001
   - API: http://localhost:5001
   - Postgres: localhost:5432

3. To rebuild after dependency changes:

   ```bash
   docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```

4. Stop everything:

   ```bash
   docker compose down
   ```

### Migrations

Migrations run automatically when the API container starts. To create a new migration after changing models:

```bash
docker compose exec api flask db migrate -m "describe the change"
```

Then commit the new file in `migrations/versions/` and restart the API container to apply it.

To manually run pending migrations:

```bash
docker compose exec api flask db upgrade
```

## Testing

### Frontend

```bash
cd web
npm test           # watch mode
npm run test:run   # single run
npm run test:coverage
```

Uses [Vitest](https://vitest.dev/) with [Testing Library](https://testing-library.com/) and jsdom.

### Backend

```bash
cd api
uv run pytest
```

Uses [pytest](https://docs.pytest.org/) with fixtures for the Flask app and database.

## Code Quality

- **Frontend**: ESLint + Prettier, enforced via pre-commit hook
- **Backend**: Black formatter, enforced via pre-commit hook
- **Git hooks**: Husky + lint-staged runs formatters and linters on staged files

## License

This is a personal project and is not currently licensed for redistribution.
