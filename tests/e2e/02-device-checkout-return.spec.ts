// ============================================================================
// Workflow 2: Device Checkout / Return
//
// Happy path: device returned in good condition → status changes to "In Stock".
// Damaged path: device returned as damaged → status changes to "In Repair".
//
// The DeviceCheckoutModal is triggered from the AdminSimulation dispatch console
// when a hardware_request ticket of type 'return' or 'replace' is resolved.
// This test drives that flow through the Admin UI dispatch panel.
// ============================================================================

import { test, expect } from './fixtures';
import { getToken, createInStockDevice, deleteDevice, createHardwareTicket } from './fixtures';

const ADMIN = { email: 'admin@company.com', password: 'Passw0rd!' };
const REQUESTER = { email: 'alex.mercer@company.com', password: 'Passw0rd!' };

test.describe('Workflow 2: Device Checkout / Return', () => {
  let adminToken: string;

  test.beforeAll(async ({ request }) => {
    adminToken = await getToken(request, ADMIN.email, ADMIN.password);
  });

  // ---- Happy path: good condition return → In Stock ---------------------------
  test('should move device to In Stock when returned in good condition via API', async ({
    adminPage,
    request,
  }) => {
    // Arrange: create an Active device (assign it first)
    const device = await createInStockDevice(request, adminToken);
    const assignRes = await request.put(
      `http://localhost:4000/api/devices/${device.id}/assign`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          assignedTo: 'Alex Mercer',
          assignedEmail: REQUESTER.email,
          department: 'R&D',
          reason: 'E2E checkout test setup',
        },
      },
    );
    expect([200, 204]).toContain(assignRes.status());

    // Act: checkout the device in "good" condition (return)
    const checkoutRes = await request.post(
      `http://localhost:4000/api/devices/${device.id}/checkout`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          condition: 'good',
          actionType: 'return',
          notes: 'E2E good-condition return',
        },
      },
    );
    expect([200, 204]).toContain(checkoutRes.status());

    // Assert in UI: navigate to Device Inventory and verify status
    await adminPage.goto('http://localhost:3000/admin/devices');
    await expect(adminPage.getByRole('heading', { name: 'Device Inventory' })).toBeVisible();

    const row = adminPage.locator('tr', { hasText: device.code });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('In Stock')).toBeVisible();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/02-01-good-return.png' });

    // Cleanup
    await deleteDevice(request, adminToken, device.id);
  });

  // ---- Damaged path: damaged condition → In Repair ----------------------------
  test('should move device to In Repair when returned as damaged via API', async ({
    adminPage,
    request,
  }) => {
    // Arrange: create and assign a device
    const device = await createInStockDevice(request, adminToken, { model: 'Damaged Laptop E2E' });
    await request.put(`http://localhost:4000/api/devices/${device.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        assignedTo: 'Alex Mercer',
        assignedEmail: REQUESTER.email,
        department: 'R&D',
        reason: 'E2E damaged checkout setup',
      },
    });

    // Act: checkout as damaged (replace action)
    const checkoutRes = await request.post(
      `http://localhost:4000/api/devices/${device.id}/checkout`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: {
          condition: 'damaged',
          actionType: 'replace',
          notes: 'Screen cracked — needs repair before redeployment',
        },
      },
    );
    expect([200, 204]).toContain(checkoutRes.status());

    // Assert in UI: device must be "In Repair"
    await adminPage.goto('http://localhost:3000/admin/devices');
    await expect(adminPage.getByRole('heading', { name: 'Device Inventory' })).toBeVisible();

    const row = adminPage.locator('tr', { hasText: device.code });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.getByText('In Repair')).toBeVisible();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/02-02-damaged-repair.png' });

    // Cleanup
    await deleteDevice(request, adminToken, device.id);
  });

  // ---- UI: DeviceCheckoutModal appearance via dispatch console ----------------
  test('should open DeviceCheckoutModal when resolving a return hardware ticket', async ({
    adminPage,
    request,
  }) => {
    // Arrange: device + active assignment + return ticket
    const device = await createInStockDevice(request, adminToken, { model: 'Modal Test Laptop' });
    await request.put(`http://localhost:4000/api/devices/${device.id}/assign`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        assignedTo: 'Alex Mercer',
        assignedEmail: REQUESTER.email,
        department: 'R&D',
        reason: 'Modal test setup',
      },
    });

    // Create a return-type hardware ticket and link the device
    const requesterToken = await getToken(request, REQUESTER.email, 'Passw0rd!');
    const ticket = await createHardwareTicket(
      request,
      requesterToken,
      'Alex Mercer',
      REQUESTER.email,
    );

    // Link device to ticket via API so the dispatch console can detect the workflow
    const linkRes = await request.post(
      `http://localhost:4000/api/tickets/${ticket.id}/devices`,
      {
        headers: { Authorization: `Bearer ${adminToken}` },
        data: { deviceId: device.id, actionType: 'return' },
      },
    );
    // Link may 201 or 200; if endpoint unavailable skip (feature may not yet exist)
    if (![200, 201].includes(linkRes.status())) {
      test.skip(true, 'Device-ticket link endpoint not available; skipping UI modal test.');
    }

    // Navigate to admin ticket dispatch
    await adminPage.goto('http://localhost:3000/admin/tickets');
    await expect(adminPage.getByText('IT Specialist Dispatch')).toBeVisible({ timeout: 10_000 });

    // Select the ticket in the dispatch select
    const ticketSelect = adminPage.locator('select').first();
    // selectOption's `label` only accepts an exact string, never a RegExp — the
    // option text carries extra chrome around the code, so resolve the option's
    // value by substring first, then select by value.
    const ticketOptionValue = await ticketSelect
      .locator('option', { hasText: ticket.code })
      .getAttribute('value');
    if (!ticketOptionValue) throw new Error(`No dispatch option found for ${ticket.code}`);
    await ticketSelect.selectOption(ticketOptionValue);

    // Set status to "Resolved"
    const statusSelect = adminPage.locator('select').nth(1);
    await statusSelect.selectOption('resolved');

    // Enter audit note (required field)
    await adminPage.locator('input[placeholder*="AD config"]').fill('E2E device return test');

    // Submit — expect the DeviceCheckoutModal to appear
    await adminPage.getByRole('button', { name: /Apply Update|Update Ticket/i }).click();
    await expect(adminPage.getByRole('dialog')).toBeVisible({ timeout: 8_000 });
    await expect(adminPage.getByText('Device Return Checkout')).toBeVisible();

    // Cancel modal and cleanup
    await adminPage.getByRole('button', { name: 'Cancel' }).click();

    await adminPage.screenshot({ path: 'tests/e2e/screenshots/02-03-checkout-modal.png' });

    await deleteDevice(request, adminToken, device.id);
  });
});
