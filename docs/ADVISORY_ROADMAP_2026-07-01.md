# VOC Portal — Advisory & Roadmap

**Date:** 2026-07-01
**Scope:** VOC ticket management + IT device/asset module + reporting + (future) approval & mailing
**Verdict:** This is **not greenfield — roughly 80% built.** The two core modules exist and largely work. The priority is *stabilize + close specific gaps*, not rebuild.

---

## 0. TL;DR

- **VOC ticketing** (main-item → sub-item classification, lifecycle, comments, history, attachments, device links, several reports) — **built and mature.**
- **IT device/asset** (status, specs/config, MAC, assign/checkout tied to hardware-request tickets, 12 reports, inventory UI, pivot table, CSV import) — **built and mature.**
- **Recent uncommitted work** already fixes the 3 critical runtime bugs and the main data-leak (see §2.3). Commit it.
- **Still blocking:** a broken build config, shipped demo credentials, unscoped stats endpoints, zero backend tests.
- **Your stated needs map to:** mostly-built (VOC main/sub, device status/config), partially-built (reports), **greenfield (purchase fields, approval, mailing).**

---

## 1. The one question that changes the answer: **deployment environment**

Where does this portal run in production?

- **(A) Networked** (normal LAN/internet reachable) → external SMTP for mailing and the `@google/genai` Gemini feature are both fine.
- **(B) Airgap / no-egress** (like the NVR "Production PC") → **mailing must use an internal SMTP relay**, and the **Gemini AI classification is a data-egress problem** — ticket text would leave the building. Reconsider/drop it or replace with a local model.

This gates the mailing design and the AI feature. Everything else below is environment-agnostic. **Please confirm A or B.**

---

## 2. Current state (verified 2026-07-01)

### 2.1 Stack
| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 6, TypeScript 5.8, Tailwind 4, lucide-react, `motion`, `@google/genai` (Gemini, currently a stub) |
| Backend | Express 4 (TS/ESM via `tsx`), **MySQL 8** with **raw parameterized SQL** (repo pattern, no ORM), JWT + bcrypt, Zod, helmet, rate-limit, multer, pino |
| Tests | Frontend Vitest + Playwright; **backend: none** |
| Deploy | Docker Compose (MySQL 8.4 / node20 backend / nginx frontend) |

### 2.2 What's built
- **VOC:** 3-level taxonomy `categories → subcategories → request_types` (lookup tables, not enums), tickets coded `REQ-YYYY-NNNN`, enforced status machine `submitted → waiting → resolved/rejected`, comments, `ticket_history` audit, attachments, `ticket_device_links`, reports: pending-hardware / fulfillment-time / age-buckets / **category-trend**.
- **Device:** `devices` with `status ENUM('In Stock','Active','In Repair','Retired','Lost')`, specs (CPU/RAM/storage/GPU/PSU + `specs_json`), `mac_addresses`, `device_history`, assign/checkout workflow triggered by `hardware_request` tickets, 12 device report endpoints, inventory UI + **pivot table** + CSV import.

### 2.3 Fixed but **uncommitted** (commit these first)
- **C-1** new-device hardware ticket 500 → read-back now uses the same txn connection (`device.repo.ts`).
- **C-2** return-as-`damaged` 500 → `condition_state` enum now includes `'damaged'` (`03_it_devices.sql`).
- **IDOR** → requester now scoped to own tickets on **list**, **detail**, and **attachment download** (`ticket.controller.ts`, `attachment.controller.ts`).
- ⚠️ The enum change is in the **init** SQL — it only runs on a *fresh* DB. An existing DB needs an explicit `ALTER TABLE device_history MODIFY condition_state ENUM(...)` migration.

### 2.4 Still open (real, not yet addressed)
1. **BUILD-1 (top blocker):** `vite@^6.2.3` with `@vitejs/plugin-react@^6.0.3` — plugin-react 6 requires Vite 7+. `npm ci` / Docker build fails; dev server won't boot cleanly. Pin a compatible pair (either Vite 7 + plugin-react 6, or plugin-react 4 + Vite 6) and regenerate the lockfile.
2. **Shipped demo credentials:** demo mode + hardcoded admin password `Passw0rd!` in the built bundle and seed. Remove demo mode, move admin bootstrap to env, rotate.
3. **Unscoped stats:** `/tickets/stats/summary` and `/stats/recent` weren't in the IDOR fix — verify a `requester` can't see global counts/PII.
4. **Zero backend tests;** frontend coverage overstated (audit: ~62 cases covering only `api/client.ts`, threshold set to 40% vs the 80% standard).
5. **Taxonomy duplicated:** DB `categories/*` **and** a hard-coded `src/data/categories.ts` — drift risk. Make the form fetch from the API.
6. **Orphaned reporting code:** a richer `Dashboard.tsx` (hand-rolled SVG pie/bar charts) and `TicketReportsPage.tsx` (trend/age/fulfillment tabs) exist but are **not wired into `App.tsx`**.

---

## 3. Requirements → gap analysis

| Your requirement | Status | Gap / action |
|---|---|---|
| VOC by **main item + sub item** | ✅ Built | `categories → subcategories → request_types`. De-dup taxonomy (API vs hard-coded). |
| IT equipment **issue on request** | ✅ Built | assign/checkout tied to `hardware_request` tickets. |
| Device **status** classification | ✅ Built | `In Stock/Active/In Repair/Retired/Lost` (no separate "broken" — folded into In Repair). |
| **Configuration** management | ✅ Built | CPU/RAM/storage/GPU/PSU + `specs_json`. |
| **Purchase** (vendor/cost/PO…) | ❌ **Missing** | Only `purchase_date` + `warranty_expiry`. Add procurement fields (§4.1). |
| Reports: **pivot / graph / trend** | 🟡 Partial | Device pivots live; ticket `category-trend` endpoint live but its UI is orphaned; **no chart library**. Wire + add ticket pivot/charts (§5). |
| **Approval** per request (future) | ❌ Greenfield | Design schema now, build later (§4.2). |
| **Mailing** notifications (future) | ❌ Greenfield | Outbox pattern; SMTP choice depends on §1 (§4.3). |

---

## 4. Recommended data-model additions

### 4.1 Purchase / procurement
Two options:
- **Light (recommended first):** add columns to `devices` — `vendor`, `purchase_cost DECIMAL`, `currency`, `po_number`, `invoice_no`, `supplier`. Fast; fits the existing device form.
- **Full:** a `purchases` (PO header) + `purchase_items` (lines) pair, linked to `devices` — needed only if one PO buys many devices and you want procurement reporting (spend by vendor/period). Add later if required.

### 4.2 Approval (design now, build in Phase 2)
- Tables: `approval_rules` (per `request_type` / category → approver role or user, threshold), `approvals` (ticket_id, step, approver, decision, decided_at, note).
- Insert an **approval gate** into the status machine: `submitted → pending_approval → approved → waiting/in-progress → resolved`, with `rejected` reachable from `pending_approval`. Keep rules data-driven so approvers vary by request type.

### 4.3 Mailing (design now, build in Phase 3)
- **Outbox pattern:** a `notifications` table (event, recipient, template, payload, status, attempts, sent_at) written inside the same txn as the triggering action; a small sender worker drains it. This **decouples from the SMTP choice** and works in both networked and airgap (internal relay) environments.
- Trigger events: ticket created, status change, approval-needed, assigned, resolved. Templated bodies.

### 4.4 Taxonomy single-source
Expose `GET /categories` (already have the tables) and have `RequestForm` consume it; retire the hard-coded `src/data/categories.ts`.

---

## 5. Reporting recommendation

- **Wire the orphaned `Dashboard.tsx` + `TicketReportsPage.tsx`** — they already contain SVG charts and the trend/age/fulfillment tabs backed by live endpoints. Fastest win.
- **Charting:** none installed today (charts are hand-rolled SVG/CSS). For richer pivots/trends, adding **recharts** (or visx) is fine — both bundle locally with **no CDN/egress**, so they're airgap-safe. If you want zero new deps, the existing SVG components are serviceable.
- **Generalize the device pivot** (`DeviceInventoryPivotTable`) into a reusable pivot for **tickets** too (main-item × status, main-item × month).
- **Add**: ticket trend chart (the `category-trend` endpoint already returns month buckets), and **CSV/Excel export** on report tables.

---

## 6. Phased roadmap

**Phase 0 — Stabilize (do before any new feature; ~1–2 days)**
1. Commit the in-flight fixes (C-1, C-2, IDOR).
2. Fix **BUILD-1** (align Vite/plugin-react, regenerate lockfile) → green `npm ci` + Docker build.
3. Remove demo mode + hardcoded admin password; move to env + rotate.
4. Verify/scope the stats endpoints for requesters.
5. Add the `ALTER TABLE` migration for the `condition_state` enum on existing DBs.
6. Backend smoke tests for the critical paths (create hardware ticket, assign, checkout-damaged, IDOR).

**Phase 1 — Close stated gaps**
- Purchase fields + device form UI (§4.1 light).
- Wire orphaned dashboards; add ticket pivot + trend charts + export (§5).
- Taxonomy from API (§4.4).

**Phase 2 — Approval workflow** (§4.2): schema, per-request-type approver rules, approval gate in the status machine, approver UI + queue.

**Phase 3 — Mailing** (§4.3): outbox + templates + sender; SMTP per §1; wire to events incl. approval.

**Cross-cutting:** backend test suite (currently zero), enable strict TypeScript, secret hardening, nginx security headers, don't publish MySQL port to host.

---

## 7. Risks / watch-outs
- Enum/schema changes in `database/init/*` only apply to **fresh** DBs — always pair with an explicit `ALTER` migration for running instances.
- **Gemini** (`@google/genai`) is external egress — a blocker in an airgap deployment (§1).
- Test-coverage claims in commit messages (149 tests / 85%) are **overstated** vs the 2026-06-29 audit (62 cases, `api/client.ts` only, backend zero). Treat the audit as ground truth.
- The audit `SECURITY_QA_AUDIT_2026-06-29.md` predates the in-flight fixes — re-verify before treating any of its C-1/C-2/IDOR items as still-open.
