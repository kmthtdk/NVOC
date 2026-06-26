// ============================================================================
// Shared Playwright fixtures and helpers for N-VOC E2E tests.
// ============================================================================

import { test as base, expect, type Page } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ADMIN_AUTH_FILE = path.join(__dirname, '.auth/admin.json');
export const REQUESTER_AUTH_FILE = path.join(__dirname, '.auth/requester.json');

export const API_BASE = 'http://localhost:4000/api';

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

// ---- UI navigation helpers -------------------------------------------------

/** Navigate to the IT Admin Workspace and optionally to a sub-tab. */
export async function goToAdminWorkspace(
  page: Page,
  tab: 'tickets' | 'devices' = 'tickets',
) {
  await page.goto('http://localhost:3000');
  await page.getByRole('button', { name: 'IT Admin Workspace' }).click();
  await expect(page.getByText('IT Admin Workspace')).toBeVisible();

  if (tab === 'devices') {
    await page.getByRole('button', { name: /Device/i }).click();
    await expect(page.getByText('Device Inventory')).toBeVisible();
  }
}

/** Navigate to the Employee Portal (user view). */
export async function goToEmployeePortal(page: Page) {
  await page.goto('http://localhost:3000');
  const empBtn = page.getByRole('button', { name: 'Employee Portal' });
  if (await empBtn.isVisible()) {
    await empBtn.click();
  }
  await expect(page.getByText(/Submit a Request|New Request|Employee Portal/i)).toBeVisible();
}

/** API helper: get a bearer token for a user. */
export async function getToken(
  request: import('@playwright/test').APIRequestContext,
  email: string,
  password: string,
): Promise<string> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.token as string;
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
  expect(res.status()).toBe(201);
  const body = await res.json();
  return { id: String(body.data.id ?? body.data.ticketId), code: body.data.code };
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
