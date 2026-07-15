# N-VOC System Service Portal

An IT service-desk and asset-management portal: raise and track VOC tickets, manage
the IT device inventory, and drive the hardware-request → assign → checkout workflow —
with an approval chain, reporting, and a fully offline release path for air-gapped
deployment.

> **Version 1.2.0** · ships as a self-contained offline bundle. See
> [docs/RELEASE_1.2.0.md](docs/RELEASE_1.2.0.md).

---

## Features

- **VOC ticketing** — three-level taxonomy (`categories → subcategories → request_types`),
  tickets coded `REQ-YYYY-NNNN`, an enforced status machine
  (`submitted → pending_approval → waiting → resolved/rejected`), comments, an audited
  history, and attachments.
- **Approval workflow** — data-driven approver rules per request type, an approval gate
  in the status machine, and an approver queue. Self-approval is blocked; decisions are
  anchored to the requester identity from the JWT.
- **IT device / asset management** — status (`In Stock / Active / In Repair / Retired /
  Lost`), full PC specs (CPU/RAM/storage/GPU/PSU + free-form `specs_json`), MAC
  addresses, asset codes, assign/checkout tied to `hardware_request` tickets, CSV import,
  an inventory pivot table, and device reports.
- **Reporting** — pending-hardware, fulfillment-time, age buckets, category trend, and
  device report endpoints.
- **Security** — JWT + bcrypt auth, role scoping (requester / it_support / admin),
  requester-scoped access (IDOR-hardened), Zod validation, helmet, rate limiting, and
  parameterized SQL throughout.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4, lucide-react, `motion`, React Router 7 |
| Backend | Express 4 (TypeScript/ESM via `tsx`), MySQL 8.4 with raw parameterized SQL (repository pattern), JWT, bcrypt, Zod, helmet, pino |
| Tests | Vitest (unit) + Playwright (E2E); backend unit + integration on real MySQL |
| Deploy | Docker Compose (MySQL 8.4 / Node 20 backend / nginx frontend) |

## Run locally (development)

Requires Docker.

```bash
cp .env.example .env      # fill in DB passwords + JWT_SECRET (see the file's comments)
docker compose up --build
```

- Frontend: http://localhost:3005
- API: proxied under `/api` (backend on 4001, DB on 3307 — both bound to localhost)

Login with a seeded demo account (development only): `admin@company.com` / `Passw0rd!`.
Demo accounts are blocked at login in production once `ADMIN_PASSWORD` is set.

### Frontend-only dev server

```bash
npm install
npm run dev               # Vite on :3000
```

## Tests

```bash
npm run test              # frontend unit (Vitest)
npm run test:e2e          # Playwright E2E
cd backend && npm test    # backend unit
```

## Releasing (offline / air-gapped target)

The production machine has **no internet** — no `npm install`, no `docker pull`, no
CDN. Every release is a single self-contained bundle built on a machine that does have
internet.

```bash
./scripts/release-gate.sh          # 10-check gate; nothing ships unless it exits 0
./scripts/build-release.sh         # → release/voc-<version>.tar.gz (images + schema + scripts)
```

The bundle stamps its version into the image (`APP_VERSION`), exposes it at
`GET /api/version`, and records it in `MANIFEST.json`. On the target:

```bash
tar -xzf voc-<version>.tar.gz
./scripts/install.sh               # first install
./scripts/update.sh                # upgrade a running system (migrations + rollback snapshot)
./scripts/rollback.sh              # revert to the previous version
```

After any install/update, verify `curl http://<host>/api/version` reports the expected
version — if it disagrees with the bundle, the update did not land.

## Documentation

- [docs/RELEASE_1.2.0.md](docs/RELEASE_1.2.0.md) — the current release: bundle, gate results, deploy steps
- [CHANGELOG.md](CHANGELOG.md) — version history
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/DOCKER.md](docs/DOCKER.md) — deployment detail
- [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) — pre-production checklist
- [docs/ADVISORY_ROADMAP_2026-07-01.md](docs/ADVISORY_ROADMAP_2026-07-01.md) — roadmap and gap analysis
