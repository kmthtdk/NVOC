// ============================================================================
// Shared Playwright fixtures and helpers for N-VOC E2E tests.
// ============================================================================

import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ADMIN_AUTH_FILE = path.join(__dirname, '.auth/admin.json');
export const REQUESTER_AUTH_FILE = path.join(__dirname, '.auth/requester.json');

export const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:4000/api';

// ---- Typed fixtures --------------------------------------------------------

type Fixtures = {
  adminPage: Page;
  requesterPage: Page;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: ADMIN_AUTH_FILE,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  requesterPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: REQUESTER_AUTH_FILE,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect };

// Navigation is a route now, not a tab in component state, so the specs simply
// page.goto() their destination. The two helpers that used to click through the
// horizontal tab bar are gone rather than merely rewritten: nothing called them,
// and a dead `goToEmployeePortal` that quietly landed on /requests/new — the
// FORM, not the list — is a trap laid for whoever reaches for it next.

/**
 * API helper: get a bearer token for a user — WITHOUT logging in again.
 *
 * Every spec called this in its own beforeAll, some again mid-test, so a run
 * fired ten-plus logins in two minutes and the backend's login rate limiter
 * (10 per 15 minutes, per IP) correctly answered 429. Two full runs failed that
 * way, on 429s, before a single assertion about the UI ever executed. The limiter
 * is right; the suite was wrong to hammer it — and a per-module memo did not fix
 * it, because it does not reliably survive across spec files.
 *
 * global.setup already logs each role in through the UI, and the app stores its
 * JWT in localStorage. That token is sitting in the storageState file we saved.
 * Read it. The whole suite now costs exactly two logins — the two the setup
 * project already had to do.
 */
const IT_LEADER_AUTH_FILE = path.join(__dirname, '.auth/it-leader.json');

const AUTH_FILE_BY_EMAIL: Record<string, string> = {
  'admin@company.com': ADMIN_AUTH_FILE,
  'alex.mercer@company.com': REQUESTER_AUTH_FILE,
  'marcus.vance@company.com': IT_LEADER_AUTH_FILE,
};

export async function getToken(
  _request: import('@playwright/test').APIRequestContext,
  email: string,
  _password?: string,
): Promise<string> {
  const file = AUTH_FILE_BY_EMAIL[email];
  if (!file) throw new Error(`No stored auth state for ${email}; add it to global.setup.ts`);

  const state = JSON.parse(await readFile(file, 'utf8')) as {
    origins?: { localStorage?: { name: string; value: string }[] }[];
  };
  const token = state.origins?.[0]?.localStorage?.find((e) => e.name === 'nvoc_token')?.value;
  expect(token, `no nvoc_token in ${file} — did global.setup actually sign in?`).toBeTruthy();
  return token as string;
}

/** API helper: create an In Stock device and return its id + code. */
export async function createInStockDevice(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  overrides?: { model?: string; deviceType?: string },
): Promise<{ id: number; code: string; serialNumber: string }> {
  const serial = `SN-E2E-${Date.now()}`;
  const res = await request.post(`${API_BASE}/devices`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      deviceType: overrides?.deviceType ?? 'laptop',
      model: overrides?.model ?? 'E2E Test Laptop',
      serialNumber: serial,
      status: 'In Stock',
      notes: 'Created by E2E test',
    },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: body.data.id, code: body.data.code, serialNumber: serial };
}

/** API helper: submit a hardware_request ticket and return its id + code. */
export async function createHardwareTicket(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  requesterName: string,
  requesterEmail: string,
): Promise<{ id: string; code: string }> {
  const res = await request.post(`${API_BASE}/tickets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      title: 'E2E Hardware Request - Laptop Needed',
      category: 'hardware_request',
      subcategory: 'laptop',
      requestType: 'laptop',
      priority: 'medium',
      description: 'E2E test: need a new laptop for development work.',
      requesterName,
      requesterEmail,
      requesterDept: 'Engineering & Infrastructure',
    },
  });
  expect(res.status(), `ticket create failed: ${await res.text()}`).toBe(201);
  // POST /tickets answers { ticket }, not { data } — devices use { data }. The
  // envelope is not consistent across the API and the test assumed it was.
  const { ticket } = await res.json();
  return { id: String(ticket.id), code: ticket.code };
}

/**
 * API helper: walk a ticket through the approval chain.
 *
 * The seeded flow gates every request behind two signatures — the requester's
 * department leader, then the IT leader. A new ticket therefore lands in
 * `pending_approval`, and `pending_approval -> waiting` is not a legal
 * transition, so IT cannot touch it until it has been approved. The workflow
 * specs predate the approval gate and tried to move a brand-new ticket straight
 * to `waiting`; the API answered 400, correctly, and the tests read that as a
 * bug in the app.
 *
 * Two passes: step 2 only becomes pending once step 1 has signed.
 */
export async function approveTicket(
  request: import('@playwright/test').APIRequestContext,
  ticketId: string,
): Promise<void> {
  const approvers = ['admin@company.com', 'marcus.vance@company.com'];

  for (let pass = 0; pass < 2; pass++) {
    for (const email of approvers) {
      const token = await getToken(request, email);
      const res = await request.get(`${API_BASE}/tickets/approvals/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status() !== 200) continue;

      // The inbox rows are raw SQL: the ticket is `id` and the step is `step_order`.
      // Reading `step` gave undefined and posted to /approvals/undefined/decide.
      const { pending = [] } = await res.json();
      const mine = (pending as { id: unknown; step_order: number }[]).filter(
        (p) => String(p.id) === String(ticketId),
      );

      for (const item of mine) {
        const decided = await request.post(
          `${API_BASE}/tickets/${ticketId}/approvals/${item.step_order}/decide`,
          {
            headers: { Authorization: `Bearer ${token}` },
            data: { decision: 'approve', note: 'E2E: approved' },
          },
        );
        expect(
          decided.ok(),
          `approve step ${item.step_order} as ${email}: ${decided.status()} ${await decided.text()}`,
        ).toBeTruthy();
      }
    }
  }
}

/**
 * API helper: delete a ticket (teardown).
 *
 * The suite created tickets and never removed them — only devices had a teardown.
 * Run against a real database (which is the only way this suite runs at all) that
 * means every execution left its test tickets behind, in someone's actual queue.
 */
export async function deleteTicket(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  ticketId: string,
): Promise<void> {
  if (!ticketId) return;
  await request.delete(`${API_BASE}/tickets/${ticketId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** API helper: delete a device (teardown). */
export async function deleteDevice(
  request: import('@playwright/test').APIRequestContext,
  token: string,
  deviceId: number,
): Promise<void> {
  await request.delete(`${API_BASE}/devices/${deviceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
