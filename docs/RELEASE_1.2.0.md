# Release 1.2.0 — N-VOC System Service Portal

**Built:** 2026-07-15 · **Commit:** `52eca37` · **Bundle:** `release/voc-1.2.0.tar.gz` (299 MB)
**SHA-256:** `11b53f0fd42fe8175b6e93f89feb9c94f5cbff224f647512f2b4dd433b0bfc26`

This is an **offline release** for the airgapped Production PC. Everything the box
needs is baked in — Docker images, schema, migrations, fonts. Nothing reaches the
network at run time.

---

## What shipped

Full detail in [../CHANGELOG.md](../CHANGELOG.md). Summary:

| Type | Change |
|------|--------|
| Fixed | A device could not be booked into the store — frontend `DeviceStatus` union was missing `'In Stock'`. It is now the default; hardware arrives before it is issued. |
| Fixed | Search could not find a record by its identifier (`GR-2026-0001`, `asset_code`). Added a `LIKE` over identifier columns, OR-ed into the fulltext clause, AND-ed with requester scope. |
| Added | A vertical **navigation rail** (drawer below `lg`) replacing the horizontal tab row. |
| Added | A global **command bar** (`Ctrl/Cmd+K`) that searches tickets + devices and deep-links to the record. Requesters are never offered device inventory. |
| Changed | Elevation, cards and tables defined once in `src/index.css` (`.surface*`, `.data-table`) from the design spec — no more per-card improvised shadows. |
| A11y | Real focus-trap stack for overlays: only the topmost owns Tab/Escape; scroll lock on `html`, released when the last overlay closes. |
| Tests | E2E suite made runnable again and folded into the release gate (19 tests). |

---

## Verification (release gate — 10/10 PASS)

Run on the Dev PC via `./scripts/release-gate.sh`. Nothing ships unless it exits 0.

1. Backend typecheck (tests included) — PASS
2. Frontend typecheck (strict) — PASS
3. Backend unit — PASS
4. Backend integration (real MySQL 8.4) — PASS
5. Frontend unit — PASS
6. Offline audit (no external hosts in source) — PASS
7. Design tokens (no off-palette colour classes) — PASS
8. Production `vite build` — PASS
9. E2E workflows — device assignment, checkout/return, hardware request, dispatch — PASS
10. Upgrade rehearsal — `update.sh` + forced `rollback.sh` on a scratch stack — PASS

The built bundle was additionally audited for phone-home: **no external hosts**,
**24 font files bundled locally**.

---

## Bundle contents

```
voc-1.2.0.tar.gz
├── MANIFEST.json                 # product, version 1.2.0, commit 52eca37, offline:true
├── SHA256SUMS                    # checksum of every file in the bundle
├── docker-compose.prod.yml       # no build: blocks — images are pre-baked
├── env.example                   # copy to .env, fill secrets (see below)
├── images/voc-images.tar.gz      # docker save: voc-backend, voc-frontend, mysql:8.4
├── database/init/                # fresh-DB schema
├── database/migrations/          # ordered migrations for an existing DB
└── scripts/{install,update,rollback}.sh
```

`MANIFEST.json`:

```json
{
  "product": "n-voc-system-service-portal",
  "version": "1.2.0",
  "builtAt": "2026-07-15T00:31:07Z",
  "commit": "52eca37",
  "images": ["voc-backend:1.2.0", "voc-frontend:1.2.0", "mysql:8.4"],
  "offline": true
}
```

---

## Deploy on the Production PC (airgapped)

Copy `voc-1.2.0.tar.gz` to the box, then:

```bash
tar -xzf voc-1.2.0.tar.gz
cp env.example .env          # then edit: set real MYSQL_ROOT_PASSWORD, DB_PASSWORD,
                             # JWT_SECRET (openssl rand -hex 32), ADMIN_EMAIL/ADMIN_PASSWORD

./scripts/install.sh         # FIRST install (loads images, starts stack, runs init schema)
#   — or —
./scripts/update.sh          # UPGRADE a running system (loads new images, runs pending
                             # migrations, restarts; keeps a snapshot for rollback)
```

### Rollback

```bash
./scripts/rollback.sh        # returns to the previously installed version + DB snapshot
```

---

## Version-truth check (do this after every install/update)

The whole point of stamping the version is to prove what is running. After deploy:

```bash
curl -s http://<host>/api/version
```

It must report `1.2.0`. **If the runtime version and the bundle version disagree,
the update did not land** — do not consider the release complete. The version is
baked into the image env (`APP_VERSION`) at build time and read by `GET /api/version`;
it is also visible in the UI.

---

## Secrets checklist (before first production boot)

`env.example` ships placeholders only. Fill these in `.env`:

- `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD` — strong random values.
- `JWT_SECRET` — `openssl rand -hex 32`. The backend refuses to boot on a known-weak secret.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — the real admin. Once set, demo accounts (`Passw0rd!`)
  are blocked at login even after a DB re-seed.
- `VITE_DEMO_PASSWORD` — leave **blank** in production (a non-empty value ships the demo
  password inside the frontend bundle).
- `GEMINI_API_KEY` — external egress; leave blank on the airgapped box.

---

## Known follow-ups (roadmap Phase 1)

See [ADVISORY_ROADMAP_2026-07-01.md](ADVISORY_ROADMAP_2026-07-01.md). Next feature work:
procurement/purchase fields on devices, wiring the orphaned dashboards + ticket
trend/pivot charts, and serving taxonomy from the API instead of the hard-coded copy.
