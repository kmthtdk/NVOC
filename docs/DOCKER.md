# N-VOC Request System — Docker Guide

Full-stack, three-service containerized deployment: React/Vite SPA (Nginx),
Express/TypeScript API, and MySQL 8.4 with auto-initialized schema + seed data.

## Architecture

```
                 host:3000                 host:4000 (optional)
                     │                          │
            ┌────────▼─────────┐       ┌────────▼─────────┐      ┌──────────────┐
 browser ──▶│ voc-frontend     │       │ voc-backend      │      │ voc-db       │
            │ Nginx :3000      │       │ Express :4000    │      │ MySQL :3306  │
            │ serves SPA       │       │ /api, /health    │      │ utf8mb4      │
            │ proxies /api ────┼──────▶│ ─────────────────┼─────▶│ voc_system   │
            └──────────────────┘ voc-net (bridge network) └──────────────┘
```

- **The SPA calls a relative `/api`**; Nginx reverse-proxies `/api/` to
  `backend:4000`. Frontend and backend are therefore same-origin in the
  browser, so browser CORS is a non-issue.
- **`VITE_API_BASE_URL` is baked at build time** (Vite inlines env vars). Leave
  it empty to keep the `/api` proxy path. Override only via a build arg for
  non-proxied deployments.
- **MySQL init scripts** in `database/init/` (`01_schema.sql`, `02_seed.sql`)
  run once, in filename order, only on a first-boot empty data directory.

## Prerequisites

- Docker Engine 24+ and Docker Compose v2 (`docker compose`, not `docker-compose`).

## Quick start

```bash
cp .env.example .env          # then edit secrets (see below)
docker compose up -d --build
```

Or use the helper scripts:

| Task        | PowerShell (Windows)        | Bash (Linux/macOS/Git Bash) |
|-------------|-----------------------------|-----------------------------|
| Start       | `.\scripts\start.ps1`       | `./scripts/start.sh`        |
| Stop        | `.\scripts\stop.ps1`        | `./scripts/stop.sh`         |
| Stop + wipe | `.\scripts\stop.ps1 -Volumes` | `./scripts/stop.sh --volumes` |
| Logs        | `.\scripts\logs.ps1 [svc]`  | `./scripts/logs.sh [svc]`   |

Then open **http://localhost:3000**. Verify the API via
**http://localhost:4000/health** (returns `{"status":"ok","db":"up"}`).

## Required environment variables

Compose **refuses to start** until these have real values in `.env`:

| Variable              | Notes                                              |
|-----------------------|----------------------------------------------------|
| `MYSQL_ROOT_PASSWORD` | MySQL root password.                               |
| `DB_PASSWORD`         | Password for the app DB user (`DB_USER`).          |
| `JWT_SECRET`          | **Must be ≥16 chars** (zod-validated at boot). Use `openssl rand -hex 32`. |

All other variables have sensible defaults (see `.env.example`).

> **Note:** `DB_HOST` and `DB_PORT` for the backend are fixed to the `db`
> service inside the compose network — you do not set them in `.env`. The
> `DB_PORT` var in `.env` only controls the host port MySQL is published on.

## Services

### `db` (voc-db) — MySQL 8.4
- Persistent named volume `voc-db-data` → `/var/lib/mysql`.
- Schema/seed mounted read-only at `/docker-entrypoint-initdb.d`.
- Healthcheck via `mysqladmin ping`; the backend waits for it to pass.
- Re-running init: the SQL scripts only execute on an empty data dir. To
  reapply them, wipe the volume: `docker compose down -v`.

### `backend` (voc-backend) — Express/TypeScript
- Multi-stage build (`backend/Dockerfile`): compiles TS → `dist/`, prunes to
  prod deps, runs as the non-root `node` user.
- `depends_on: db (service_healthy)` — won't boot until MySQL is ready
  (the app calls `assertDbConnection()` and fails fast otherwise).
- Uploads persisted to named volume `voc-uploads` → `/app/uploads`.
- Container `HEALTHCHECK` hits `/health`.

### `frontend` (voc-frontend) — Nginx
- Multi-stage build (`Dockerfile.frontend`): Vite build → static assets served
  by `nginx:1.27-alpine` on port 3000.
- `nginx.conf` provides SPA history fallback + `/api` reverse proxy +
  long-cache headers for fingerprinted `/assets/`.

## Common operations

```bash
# Tail logs (all or one service)
docker compose logs -f
docker compose logs -f backend

# Open a shell in a running container
docker compose exec backend sh
docker compose exec db sh

# MySQL CLI inside the db container
docker compose exec db mysql -uroot -p"$MYSQL_ROOT_PASSWORD" voc_system

# Rebuild a single service after code changes
docker compose up -d --build backend

# Stop everything (volumes preserved)
docker compose down

# Stop and DELETE data (DB + uploads) — forces schema re-init next start
docker compose down -v
```

## Troubleshooting

- **Backend keeps restarting** — usually the DB wasn't ready or credentials
  mismatch. Check `docker compose logs backend`. Confirm `DB_PASSWORD` in
  `.env` matches what MySQL was first initialized with. If you changed DB
  credentials after the first boot, the existing `voc-db-data` volume still has
  the old user — run `docker compose down -v` to reset.
- **`JWT_SECRET must be at least 16 characters`** — lengthen `JWT_SECRET`.
- **Schema/seed didn't load** — init scripts only run on an empty data dir.
  `docker compose down -v` then `up` to re-init.
- **Frontend loads but API calls 502** — backend isn't healthy yet, or the
  Nginx upstream name changed; ensure the backend service is named `backend`.
- **Changed `VITE_API_BASE_URL` but nothing changed** — it's build-time; rebuild
  the frontend: `docker compose up -d --build frontend`.

## Production notes

- Set strong, unique secrets in `.env`; never commit `.env`.
- Consider removing the published `db` port (`3306`) so MySQL stays internal to
  the compose network.
- Put a TLS-terminating proxy in front of `frontend`, and set `CORS_ORIGIN` to
  your real origin if you ever bypass the same-origin proxy.
- `restart: unless-stopped` is set on all services for resilience.
