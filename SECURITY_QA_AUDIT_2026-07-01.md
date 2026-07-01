# Security + QA Audit — VOC Portal — 2026-07-01

**Method:** 4 parallel agents — 2 pentest (auth/authz/IDOR; injection/secrets/config), 1 code review (correctness), 1 Playwright E2E (live functional). Static code + live probing against the running stack (`:3005` SPA / `:4001` API / `:3307` DB) + `docker exec` DB checks.

**Headline:** Functional E2E **7/7 PASS**. Phase-0 IDOR/role controls **hold live**. SQL injection / XSS / input-validation **clean**. But the audit found **2 CRITICAL** + **7 HIGH** issues — several in the newly-built approval feature and in infra exposure — that must be fixed before any non-local deployment.

---

## Findings (deduplicated across agents)

### 🔴 CRITICAL
| ID | Finding | Fix |
|----|---------|-----|
| C-1 | **Self-approval bypass.** The approval guard compares the *body-supplied* `requesterEmail` to the approver's JWT email; an admin/IT can file a ticket with a throwaway email then approve it themselves (proven live: HTTP 200). | Anchor `requester_id` from the JWT at creation; compare IDs, not emails. |
| C-2 | **Weak/static `JWT_SECRET`** (`voc_demo_secret_key_...`) — an admin token was **forged live** and accepted on `/admin/*`. | Rotate to `openssl rand -hex 32`; reject known-weak secrets at boot; keep out of files in prod. |

### 🟠 HIGH
| ID | Finding | Fix |
|----|---------|-----|
| H-1 | **Attachment upload IDOR** — any requester can upload files to *any* ticket (no ownership check on `POST /tickets/:id/attachments`). | Ownership check before accepting upload. |
| H-2 | **`GET /devices`, `/:id`, `/search` open to all authed users** — requesters read full inventory incl. new **purchase cost/supplier/PO** and personnel PII. | `requireRole('it_support','admin')` on the GET routes. |
| H-3 | **MySQL `3307` bound to `0.0.0.0`** — DB reachable off-box with the app creds. | Bind `127.0.0.1:3307` (or drop the host port). |
| H-4 | **Backend `4001` bound to `0.0.0.0`** — bypasses nginx; with `trust proxy` a spoofed `X-Forwarded-For` defeats the login rate limiter. | Bind `127.0.0.1:4001` (only nginx public). |
| H-5 | **`addSigner` into a completed chain** — a rejection on the ad-hoc step can drive a `waiting` ticket back to `rejected` (no repo-level transition guard). | Reject `addSigner` unless chain state is `in_progress`. |
| H-6 | **`decideStep` concurrent double-decision** — UPDATE lacks `AND status='pending'` + affected-rows check. | Add predicate + throw `conflict` on 0 rows. |
| H-7 | *(test integrity)* `approval.service.decide` has **no tests**; the tested `engine.insertAdHoc` isn't the runtime path (`repo.insertSigner` is). | Add service tests; remove/reconcile `insertAdHoc`. |

### 🟡 MEDIUM
- **M-1** Privileged (`it_support`/admin) override can decide a **named approver's** step (separation-of-duties). → restrict override to *unassigned* steps.
- **M-2** **No rate limiting** on approval (`decide`/`assign`/`add-signer`) and all `/admin` routes.
- **M-3** **nginx serves the SPA with zero security headers** (no CSP/X-Frame-Options/nosniff/Referrer-Policy). Helmet only covers the API.
- **M-4** **MIME validation trusts client `Content-Type`** (no magic-byte check). Contained today by `Content-Disposition: attachment` + nosniff.
- **M-5** **Demo-account disable not persistent** — a DB re-seed without a backend restart re-activates `Passw0rd!` accounts. → add an `is_demo` column checked in `findByEmail`.
- **M-6** `notes`-only ticket update is rejected by the `updateTicketSchema` refine.
- **M-7** `replaceDefaultFlowSteps` throws a generic `Error` (→ opaque 500) when the default flow is absent.
- **M-8** `pendingForUser` inbox can show steps from already resolved/rejected tickets (no `t.status` filter).
- **M-9** Device serial-number TOCTOU surfaces as a raw **500** instead of **409**.
- **M-10** ApprovalSettings: no "Unassigned" option on the inline dept-leader select; Save on an unconfigured new step gives no feedback (BUG-1).

### 🔵 LOW
- **L-1** `console.warn` logs user **email (PII)** to the browser console (`App.tsx`).
- **L-2** Dockerfiles use `npm install --no-audit` (lockfile is gitignored repo-wide — a deliberate trade-off; note the non-reproducibility).
- **L-3** Unsupported-file-type upload returns **500** instead of **400**.
- **L-4** `getStatsRecent` fetches 100 rows to return 5/status.
- **L-5** `DeviceManagement` gets a hardcoded `user={{role:'admin'}}` (dead prop; maintenance trap).
- **L-6** Ticket badge stays "Submitted" during approval-in-progress (BUG-2, UX).

### ✅ Confirmed PASS (controls that hold)
Ticket IDOR (list/detail/comment — Phase-0 fixes hold live), stats/reports role-gates (403), approval out-of-order (400) + unassigned-step block (403) + assign/add-signer role-gates (403), resolve gate (400), forged-JWT/expired/tampered (401), bcrypt hashing, account-enumeration constant-time, **SQL injection safe (all parameterized)**, **XSS safe (no dangerouslySetInnerHTML)**, zod validation on new endpoints, helmet on API, CORS restricted, login rate-limit, attachment path-traversal guarded, demo password not in bundle, `npm audit` 0 high vulns. **E2E 7/7 PASS.**

---

## Fix status (2026-07-01, same day)

**FIXED + verified (live re-probe or unit test):**
- C-1 self-approval — anchored to `requester_id` from JWT; admin approving own ticket now **403** (live).
- C-2 weak JWT_SECRET — rotated in `.env` to `openssl rand` value; boot warning added for weak/guessable secrets.
- H-1 attachment upload IDOR — ownership check added; cross-ticket upload now **404** (live).
- H-2 device GET authz — `requireRole` on `/devices`, `/:id`, `/search`; requester now **403** (live).
- H-3/H-4 infra exposure — DB `3307` + backend `4001` now bound to `127.0.0.1` (verified in `docker ps`).
- H-5 addSigner into completed chain — rejected with 409 unless chain is `in_progress`.
- H-6 decideStep race — `AND status='pending'` + affected-rows check → 409 on lost race.
- H-7 test integrity — added `approval.service.test.ts` (self-approval, named-approver binding, advance/reject, race, addSigner); removed the unused `engine.insertAdHoc`. **Backend now 32 tests, all pass.**
- M-1 named-approver override — privileged decide restricted to *unassigned* steps only.
- M-2 rate limits — `approvalLimiter` on decide/assign/add-signer; `adminLimiter` on `/admin/*`.
- M-3 nginx security headers — CSP/X-Frame-Options/nosniff/Referrer-Policy/Permissions-Policy added.
- M-5 demo-account persistence — login-time block in production (survives DB re-seed).
- M-7 `replaceDefaultFlowSteps` → `AppError.internal`.
- M-8 `pendingForUser` — excludes resolved/rejected tickets.
- M-6 notes-only ticket update — allowed by the refine.
- L-1 console PII — email removed from the client console log.

**Deferred (tracked, lower risk):**
- M-4 / L-1(pentest) MIME magic-byte validation — needs the `file-type` dep (contained today by `Content-Disposition: attachment` + nosniff).
- M-9 device serial TOCTOU → surface 409 instead of 500 (UNIQUE prevents dup; cosmetic).
- M-10 / BUG-1 ApprovalSettings: "Unassigned" option + save feedback on unconfigured step.
- L-2 `npm install` vs `npm ci` — deliberate (lockfile gitignored repo-wide).
- L-3 unsupported-file-type → 400 not 500. L-4 stats query efficiency. L-5 dead `user` prop. L-6/BUG-2 status badge during approval. BUG-3 QA rate-limit (ops).
- **Operational:** set `ADMIN_EMAIL`/`ADMIN_PASSWORD` in prod so a real admin exists once demo accounts are locked.
</content>
