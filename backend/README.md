# N-VOC Request System — Backend

Node 20 + Express + TypeScript REST API for the N-VOC IT service portal, backed by MySQL 8.

Layering: `routes → controllers → models (repositories) → mysql2 pool`. Auth via JWT,
validation via Zod, uploads via multer, structured logging via pino.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node 20 (ESM) |
| Framework | Express 4 |
| DB driver | mysql2/promise (pooled) |
| Auth | JWT (`jsonwebtoken`) + bcrypt |
| Validation | Zod |
| Uploads | multer (disk storage on a volume) |
| Logging | pino / pino-http |
| Security | helmet, cors |

## Project layout

```
backend/
├── Dockerfile                 # multi-stage build, runs as non-root, /health healthcheck
├── package.json  tsconfig.json
└── src/
    ├── index.ts               # bootstrap: assert DB, listen, graceful shutdown
    ├── app.ts                 # express app (helmet, cors, json, routes, error handler)
    ├── config/                # env (zod-validated), logger, db pool + transactions
    ├── middleware/            # auth (JWT + RBAC), validate, upload, error
    ├── routes/                # auth, categories, tickets, attachments, ai, health
    ├── controllers/           # request parsing + Zod schemas; delegate to models
    ├── models/                # repositories (all SQL) + row types + snake→camel mappers
    ├── types/                 # shared domain types (mirror frontend contract)
    └── utils/                 # AppError, asyncHandler, date/JSON helpers

database/init/                 # mounted by the db container (runs alphabetically)
├── 01_schema.sql              # tables, indexes, FKs, FULLTEXT search, sequence table
└── 02_seed.sql                # taxonomy (mirrors categories.ts), 3 demo users, 5 tickets
```

## Configuration

Copy `.env.example` to `.env` and fill it in:

```
PORT=4000
CORS_ORIGIN=http://localhost:3000
DB_HOST=localhost  DB_PORT=3306  DB_NAME=voc_system  DB_USER=voc_app  DB_PASSWORD=...
JWT_SECRET=<long random string>   JWT_EXPIRES_IN=8h
UPLOAD_DIR=./uploads   MAX_UPLOAD_BYTES=10485760
GEMINI_API_KEY=        # optional; /ai/triage falls back to heuristics when empty
```

The process validates env at boot and exits with a clear message if anything is missing.

## Run locally (without Docker)

You need a reachable MySQL 8 with the two init scripts applied:

```bash
# 1. apply schema + seed to your DB (any client)
mysql -h 127.0.0.1 -u root -p voc_system < ../database/init/01_schema.sql
mysql -h 127.0.0.1 -u root -p voc_system < ../database/init/02_seed.sql

# 2. install + run
npm install
cp .env.example .env   # edit values
npm run dev            # tsx watch (hot reload) on :4000
# or
npm run build && npm start
```

`npm run typecheck` runs `tsc --noEmit`.

## Run with Docker

The backend `Dockerfile` is multi-stage (build → prune dev deps → slim runtime, non-root
`node` user) and exposes `4000` with a container healthcheck on `/health`. It is intended to
be orchestrated by the root `docker-compose.yml` alongside the `db` service, which mounts
`./database/init` into `/docker-entrypoint-initdb.d` so the schema + seed run automatically on
first boot. `depends_on: { db: { condition: service_healthy } }` ensures the DB is ready first.

## Seed credentials

All demo users share the password **`Passw0rd!`**:

| Email | Role |
|---|---|
| `admin@company.com` | admin |
| `marcus.vance@company.com` | it_support |
| `alex.mercer@company.com` | requester |

## API

Base path `/api`. All endpoints require `Authorization: Bearer <JWT>` except `/auth/login`
and `/health`. Errors use the envelope `{ "error": { "code", "message", "details?" } }`.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/login` | none | `{ email, password }` → `{ token, user }` |
| GET | `/auth/validate` | Bearer | re-hydrate the current user |
| GET | `/categories` | Bearer | nested taxonomy (category → subcategory → type+period) |
| GET | `/tickets` | Bearer | `?status=&category=&priority=&assignedTo=&q=&page=&pageSize=&sort=` |
| GET | `/tickets/:id` | Bearer | full ticket incl. `comments[]`, `history[]`, `attachments[]` |
| POST | `/tickets` | Bearer | creates ticket; server generates `code`, seeds first history row |
| PUT | `/tickets/:id` | it_support/admin | `{ status?, priority?, assignedTo?, notes? }`; appends history |
| DELETE | `/tickets/:id` | admin | cascades comments/history/attachments |
| POST | `/tickets/:id/comments` | Bearer | `{ author, role, content }` |
| POST | `/tickets/:id/attachments` | Bearer | `multipart/form-data` field `files` (≤10) |
| GET | `/attachments/:id` | Bearer | streams the file |
| POST | `/ai/triage` | Bearer | `{ title, description }` → category/priority/summary suggestion |
| GET | `/health` | none | `{ status, db }` |

### Quick smoke test

```bash
# login
TOKEN=$(curl -s localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@company.com","password":"Passw0rd!"}' | jq -r .token)

# list tickets
curl -s localhost:4000/api/tickets -H "Authorization: Bearer $TOKEN" | jq '.total'

# get one (with nested comments/history)
curl -s localhost:4000/api/tickets/1 -H "Authorization: Bearer $TOKEN" | jq '.ticket.code'
```

## Design notes

- **`details` is a JSON column.** The per-category spec fields are sparse and only ever read
  as a blob by the frontend; normalizing into 6+ tables would add churn for data nobody
  queries individually. Top-level filtering (`status`, `category`, `priority`, `assignedTo`,
  full-text `q`) maps to indexed columns — matching current frontend behavior.
- **Ticket codes are transaction-safe.** `REQ-YYYY-NNNN` is allocated via a per-year counter
  row read with `SELECT ... FOR UPDATE` inside the same transaction as the insert, so
  concurrent POSTs never collide.
- **Timestamps are UTC end-to-end.** Columns are stored UTC; the pool uses `dateStrings`, and
  mappers emit ISO-8601 (`...Z`). `period_from`/`period_to` (collected by the form but
  previously dropped) are now persisted and validated against the request type's period flag.
- **Role vocabulary is unified:** `requester | it_support | admin`, used identically in the
  schema, seed, JWT claims, and RBAC middleware.
- **Auth, attachments, and `/ai/triage` are additive** — nothing in the current UI depends on
  them yet, so they extend the system without altering existing flows.
```
