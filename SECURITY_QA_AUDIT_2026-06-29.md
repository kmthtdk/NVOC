# Security + QA Audit — N-VOC System Service Portal
**Date:** 2026-06-29
**Method:** 4 parallel agents (2 pentest, 2 QA) on the codebase + live Playwright E2E + direct live-API verification.
**Scope:** `backend/src`, `src` (frontend), deployment config, DB seed, Playwright E2E suites.

---

## 0. Environment & How It Was Tested

- Docker daemon was up but the **Docker build is broken** (see BUILD-1), so the stack was run **natively**: backend on `:4000`, Vite frontend on `:3000`, against the existing **`voc-db` MySQL container on host `:3307`** (seeded data).
- An unrelated container **`hanwha-backend` was occupying port 3000**; the first Playwright run silently tested *that* app. It was temporarily stopped to test the real N-VOC app, then **restarted** afterward (environment restored).
- To bypass `package.json`'s broken dep pairing, `@vitejs/plugin-react@4.3.4` was installed so Vite 6 could boot. **This mutated `node_modules`** (plugin-react 6.0.3→4.3.4, "added 26 / removed 1"); `package.json`/lockfile were **not** changed, so the installed tree now diverges from source and `npm ci` still won't reproduce it until BUILD-1 is fixed.

### Live-verified facts (direct API probes, correct HTTP methods)
| Check | Result |
|-------|--------|
| Admin login → JWT | ✅ 200 |
| `GET /devices` (admin) | ✅ 200 |
| `POST /devices` (create In Stock) | ✅ 201, envelope `{data}` |
| `POST /devices/:id/assign` | ✅ 200 |
| `POST /devices/:id/checkout` `condition:"good"` | ✅ 200, envelope `{device}` |
| **`POST /devices/:id/checkout` `condition:"damaged"`** (after valid assign) | ❌ **500 "Data truncated for column 'condition_state'"** (C-2) |
| `POST /devices/:id/checkout` on In-Stock device | 400 "Device cannot be checked out. Current status: In Stock" (correct guard) |
| **`POST /tickets` deviceAction:"new"** | ❌ **500 "Device creation failed to read back"** (C-1) |
| **`GET /tickets?pageSize=100` as requester** | ❌ **200, returned ALL 21 tickets** (IDOR F-01) |

---

## 1. Playwright E2E Results

`2 passed (auth setup), 8 failed, 9 blocked` — but most failures are **test/contract drift**, not app defects:

Verdicts marked **[verified]** were reproduced against the live API; **[inferred]** are reasoned from code/snapshot but not separately re-run.

| Test | Failure | Real cause | Verdict |
|------|---------|-----------|---------|
| WF1 #4 assign | expected 200/204, got **404** | test uses `PUT /devices/:id/assign`; real route is **`POST`** (POST→200 verified) | **[verified]** TEST BUG |
| WF2 #6 assign | got **404** | same `PUT` vs `POST` | **[verified]** TEST BUG |
| WF2 #7 checkout damaged | got **400** | **two bugs:** (a) test's 400 is a *cascade* — its `PUT` assign 404s so device stays In Stock → "cannot be checked out"; (b) when reached correctly, **the damaged path itself 500s** (C-2). | **[verified]** REAL APP BUG (C-2) + test drift |
| WF2 #8 `createHardwareTicket` | `body.data` undefined | `POST /tickets` returns `{ticket}`, fixture expects `{data}` | **[verified]** CONTRACT DRIFT (envelope) |
| WF3 #9, WF4 #13 login | **429** | login rate-limiter tripped by repeated runs | **[verified]** ENV ARTIFACT |
| WF1 #3, #5 UI | timeout on `button "IT Admin Workspace"` | selector/label drift vs rendered UI (login + app render verified working) | **[inferred]** TEST/UI drift |

**Action:** realign the E2E suite to the real API (POST assign, `{ticket}`/`{device}` envelopes, UI selectors) **and** fix C-2 so the damaged-return assertion can actually pass; relax the rate-limit in the test env.

---

## 2. CRITICAL Findings (fix before anything else)

### C-1 (QA, CONFIRMED LIVE) — Every "new device" hardware ticket returns 500
`backend/src/models/device.repo.ts:315` — `create()` reads back via `this.getByIdFull(newId)` using the **pool** instead of the caller's **transaction connection** (`conn`). Under InnoDB REPEATABLE READ the new row isn't visible → throws → 500 → whole ticket rolled back. `assignToUser`/`checkout` correctly pass `conn`.
**Live proof:** `POST /tickets {deviceAction:"new"}` → `500 {"code":"INTERNAL","message":"Device creation failed to read back"}`.
**Fix:** `await this.getByIdFull(newId, conn)`.

### C-2 (CONFIRMED LIVE — found via runtime probe, missed by static review) — Damaged device returns always 500
DB enum/API enum mismatch. `database/init/03_it_devices.sql:220` defines `condition_state ENUM('new','good','fair','poor','unknown')` — **no `'damaged'`**. But `checkoutDeviceSchema` (`device.controller.ts:64`) accepts `condition: 'good'|'damaged'|'unknown'`, and `deviceRepo.checkout` (`device.repo.ts:489-491`) writes `condition` straight into `condition_state`. So any **damaged return** → MySQL `Data truncated for column 'condition_state'` → **500**, breaking the "return as damaged → In Repair" workflow. `good`/`unknown` succeed.
**Live proof:** assign (200) → `POST /devices/:id/checkout {condition:"damaged"}` → `500 {"code":"INTERNAL","message":"Data truncated for column 'condition_state' at row 1"}`.
**Fix:** reconcile the two enums — add `'damaged'` to the column (or map `damaged`→`poor` before insert) and align the API enum, DB enum, and `DeviceStatus` transition (`In Repair`).

### SEC-CRIT-1 / F-01 (Backend pentest, CONFIRMED LIVE) — Cross-user IDOR on tickets
`backend/src/routes/ticket.routes.ts:52-53` + `controllers/ticket.controller.ts:90-101`. `GET /tickets` and `GET /tickets/:id` have **no ownership/role filter**. Any requester reads all tickets + PII (name/email/dept), comments, history.
**Live proof:** requester token → `GET /tickets?pageSize=100` → 200, **21/21 tickets**.
**Fix:** for `role==='requester'`, scope `ticketRepo.list` by `requesterId` and assert ownership in `get`.

### SEC-CRIT-2 (Frontend pentest) — Demo admin credentials shipped + demo mode on in "production"
`.env` has `NODE_ENV=production` **and** `VITE_DEMO_MODE=true`, `VITE_DEMO_PASSWORD=Passw0rd!`. The built bundle (`dist/assets/index-*.js`) contains the literal `Passw0rd!` and the demo accounts array; `02_seed.sql` seeds `admin@company.com` with that password. Any visitor logs in as admin.
**Fix:** `VITE_DEMO_MODE=false`, remove `VITE_DEMO_PASSWORD` + the hardcoded `'Passw0rd!'` fallback in `Login.tsx:25`, rotate seeded passwords, rebuild.

---

## 3. HIGH Findings

### Security — Backend (IDOR family, same root: missing ownership assertion)
- **F-02** `GET /tickets/stats/{summary,recent}` — no role gate; `getStatsRecent` returns 100 tickets of all users' PII. (`ticket.routes.ts:46-47`)
- **F-03** `POST /tickets/:id/attachments` — any user uploads to any ticket. (`attachment.controller.ts:17-41`)
- **F-04** `POST /tickets/:id/comments` — any user comments on any ticket. (`ticket.routes.ts:68-73`)
- **F-05** `GET /attachments/:id` — any user downloads any attachment by id. (`attachment.routes.ts:8`)
- **F-07** Upload `fileFilter` trusts client `Content-Type`; no magic-byte check; `application/zip` allowed (zip-bomb / stored-XSS via spoofed MIME). (`middleware/upload.ts:41-44`)

### Security — Backend (config/crypto)
- **F-06 / FE-F07 (dup)** Weak, human-readable `JWT_SECRET` (`voc_demo_secret_key_2026_…`); zod only enforces ≥16. Use `openssl rand -base64 32`, bump min to 32, rotate.

### Security — Frontend / deployment
- **FE-F02** `nginx.conf` sets **no** security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) and no HTTPS redirect.
- **FE-F03** JWT stored in `localStorage` (`api/client.ts:23,27-34`) → XSS can exfiltrate; move to httpOnly+Secure+SameSite cookie.
- **FE-F04** `docker-compose.yml:26-27` publishes **MySQL** to the host (`3307:3306`) with credentials in `.env`; remove the `ports` block.

### QA — Backend
- **H-1** Unsupported upload MIME → `new Error()` → 500 instead of 400. (`upload.ts:43`)
- **H-2** Hardware ticket with missing `deviceSerialNumber` silently 201s with no device link; no cross-field zod validation. (`ticket.repo.ts:221-243`)
- **H-3** Device-serial-not-found throws bare `Error` → 500 instead of `AppError.notFound` 404. (`ticket.repo.ts:226`)
- **H-4** `attachmentRepo.createMany` not transactional → partial inserts. (`attachment.repo.ts:15-37`)
- **H-5** `getLinkedByTicketId` return type lies (`DeviceActionType` vs actual `TicketDeviceActionType`). (`device.repo.ts:729`)
- **H-6** `as any` for `MacAddressType`/`DeviceStatus` in mappers. (`mappers.ts:109,152`)
- **H-7** Report queries use `pool.query<any[]>`; `COUNT(*)` accumulated without `Number()` → string leakage. (`device.repo.ts:513-840`, `ticket.controller.ts:229-282`)

### QA — Frontend
- **H-1** `tsconfig.json` has **no `strict`/`strictNullChecks`/`noImplicitAny`** — clean `tsc` is misleading.
- **H-2** 10+ device API methods typed `Promise<any>`. (`api/client.ts:466-554`)
- **H-3a/b/c** No `AbortController` cleanup in fetch effects: `DeviceManagement.tsx:31-47`, `DeviceAssignmentModal.tsx:56-81`, `DeviceFormModal.tsx:188-210`.
- **H-4** Stale closure: `deviceType` missing from `RequestForm.tsx` effect deps (136-213).
- **H-5** `togglePermission` reads state directly instead of functional update. (`RequestForm.tsx:278-282`)

---

## 4. MEDIUM (selected)

**Security:** F-08 requester can enumerate full device inventory incl. MACs/emails (`device.routes.ts:29,40,41`); F-09 mass-assignment of `assignedTo` on ticket create; F-10 requester can spoof `requesterName/Email/Dept`; F-11 rate-limit bypass via `X-Forwarded-For` (`trust proxy`); FE-F05 backend API port published to host; FE-F06 PII logged to browser console (`App.tsx:87-89`); FE-F08 backend pkgs (`express`,`dotenv`,`@google/genai`) in frontend `dependencies`.

**QA backend:** M-3 stats load 100 rows to return 5; M-4 stats use server-local TZ vs UTC DB; M-7 response envelope inconsistency (`{data}` vs `{device}`); M-9 `device.repo.ts` 851 lines (>800); M-10 several functions >50 lines.

**QA testing gap (HIGH-ish):** the **backend has no test suite at all** — `backend/package.json` has no `test` script and no test files. The only automated tests are the frontend's 62 vitest cases (and those cover just `api/client.ts`; 0 component/context coverage). Against the 80% standard this is the single biggest coverage gap.

**QA frontend:** M-1 clock state at App root re-renders whole tree every second (PROJECT.md "fixed" — **only mitigated**, root cause remains); M-2 no ESLint/`react-hooks/exhaustive-deps`; M-13 `logout` uses `localStorage.clear()` (drops theme); M-15 coverage threshold 40% (project std 80%), **0 component tests**; M-16 orphaned dead files (`Dashboard.tsx`, `TicketReportsPage.tsx`, `DeviceImportModal.tsx`); M-17 `RequestForm.tsx` 1169L / `DeviceFormModal.tsx` 973L (>800).

---

## 5. LOW (selected)
JWT algorithm not pinned (`auth.ts:18`, add `algorithms:['HS256']`); no JWT revocation/logout (8h tokens); bcrypt dummy hash reveals cost 10 (<12); `DeviceManagement` hardcoded `role:'admin'` prop (`App.tsx:519`); demo env vars untyped in `vite-env.d.ts`; `toIso` returns raw string on NaN; unguarded `rows[0]` after insert read-backs.

---

## BUILD-1 (HIGH) — Docker build & dev server are broken
`package.json` pairs `vite@^6.2.3` with `@vitejs/plugin-react@^6.0.3`, but **plugin-react 6 requires `vite@^8`**. Result: Docker `npm ci` ERESOLVE → frontend image build fails → backend build cancelled; native `vite` dev fails with `vite/internal` not exported. Pin compatible versions (e.g. `@vitejs/plugin-react@4.3.x` for Vite 6, or upgrade Vite to 8) and regenerate the lockfile.

---

## Prioritized Remediation Order
1. **C-1** one-line fix (`getByIdFull(newId, conn)`) — restores the primary hardware-request flow.
2. **C-2** reconcile `condition_state` enum — restores damaged-return / In Repair flow.
3. **F-01 + F-05** ticket/attachment ownership scoping — stops cross-user data breach.
3. **SEC-CRIT-2** disable demo mode, rotate seeded passwords, rebuild.
4. **F-06/JWT secret** rotate + tighten.
5. **F-02/F-03/F-04** same ownership-assertion pattern as F-01.
6. **BUILD-1** fix dep pairing so CI/Docker build green.
7. **F-07** upload magic-byte validation; **FE-F02** nginx headers; **FE-F04** close DB port.
8. Realign the **Playwright suite** to the real API (POST assign, envelopes, selectors, rate-limit).
9. Hardening batch (MEDIUM) + `strict` mode + ESLint + coverage.
