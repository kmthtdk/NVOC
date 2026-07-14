// ============================================================================
// Workflow 1: Admin Device Assignment (happy path)
//
// Steps:
//   1. Admin logs in (via stored auth state)
//   2. Navigates to IT Admin Workspace → Device Inventory
//   3. Confirms an "In Stock" device is visible in the table
//   4. Opens the Add Device form (since the UI has no in-table assign button,
//      device assignment is triggered via the ticket dispatch console; this
//      workflow verifies the inventory reflects status after assignment via API)
//   5. Via API: assigns the device to a user
//   6. Reloads Device Inventory and verifies device now shows "Active" status
//      and the assigned-to name appears
// ============================================================================

import { test, expect } from './fixtures';
import { getToken, createInStockDevice, deleteDevice, API_BASE } from './fixtures';

const ADMIN = { email: 'admin@company.com', password: 'Passw0rd!' };
// A REAL account, from the seed. `jane.doe@company.com` was invented by this test
// and has no user row, so the assign endpoint now — correctly — rejects it with a
// 400: custody is a foreign key to a person, not a free-text label, and writing a
// NULL user_id for an email nobody owns is the exact silent-orphan bug the
// device_assignments work exists to prevent. The test was asserting the old model.
const ASSIGNEE = {
  name: 'Alex Mercer',
  email: 'alex.mercer@company.com',
  dept: 'R&D / Software Engineering',
};

test.describe('Workflow 1: Admin Device Assignment', () => {
  let deviceId: number;
  let deviceCode: string;
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, ADMIN.email, ADMIN.password);
    const device = await createInStockDevice(request, adminToken);
    deviceId = device.id;
    deviceCode = device.code;
  });

  test.afterAll(async ({ request }) => {
    // Best-effort cleanup — device may already be Active; delete regardless.
    await deleteDevice(request, adminToken, deviceId);
  });

  test('should display In Stock device in Device Inventory', async ({ adminPage }) => {
    await adminPage.goto('/admin/tickets');
    await expect(adminPage.getByRole('heading', { name: 'Ticket Queue' })).toBeVisible();

    // Switch to the Devices tab
    await adminPage.goto('/admin/devices');
    await expect(adminPage.getByRole('heading', { name: 'Device Inventory' })).toBeVisible();

    // The newly created device should appear in the inventory table
    await expect(adminPage.getByText(deviceCode)).toBeVisible({ timeout: 10_000 });

    // Confirm the status cell shows "In Stock"
    const deviceRow = adminPage.locator('tr', { hasText: deviceCode });
    await expect(deviceRow.getByText('In Stock')).toBeVisible();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/01-01-device-in-stock.png' });
  });

  test('should reflect Active status and assignee after API assignment', async ({
    adminPage,
    request,
  }) => {
    // Assign device via the API (mirrors what the UI dispatch console does internally)
    const assignRes = await request.post(
      `${API_BASE}/devices/${deviceId}/assign`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          userName: ASSIGNEE.name,
          userEmail: ASSIGNEE.email,
          userDept: ASSIGNEE.dept,
          reason: 'E2E assignment test',
        },
      },
    );
    // Accept 200 or 204 depending on backend implementation
    expect([200, 204]).toContain(assignRes.status());

    // Navigate to the device inventory and reload to pick up the new state
    await adminPage.goto('/admin/devices');
    await expect(adminPage.getByRole('heading', { name: 'Device Inventory' })).toBeVisible();

    // Device row must now show "Active" status
    const deviceRow = adminPage.locator('tr', { hasText: deviceCode });
    await expect(deviceRow).toBeVisible({ timeout: 10_000 });
    await expect(deviceRow.getByText('Active')).toBeVisible();

    // Assignee name should be visible in the row
    await expect(deviceRow.getByText(ASSIGNEE.name)).toBeVisible();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/01-02-device-active.png' });
  });

  test('should show device in filtered Active view', async ({ adminPage }) => {
    await adminPage.goto('/admin/devices');

    // Filter by Active status
    await adminPage.locator('select').selectOption('Active');

    // Device should remain visible in the filtered list
    await expect(adminPage.getByText(deviceCode)).toBeVisible({ timeout: 8_000 });

    // Switch filter to "In Stock" — device must no longer appear
    await adminPage.locator('select').selectOption('In Stock');
    await expect(adminPage.getByText(deviceCode)).not.toBeVisible();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/01-03-filter-active.png' });
  });
});
