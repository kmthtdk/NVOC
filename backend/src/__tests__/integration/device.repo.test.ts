import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../../config/db.js';
import { deviceRepo, type CreateDeviceInput } from '../../models/device.repo.js';

/**
 * device.repo.ts is 887 lines and had zero tests. It owns every multi-statement
 * write in the app: the FOR UPDATE device-code counter, the create/assign/checkout
 * transactions, and the device_history audit trail. All of it ran only in
 * production. These tests execute the real SQL.
 */

const baseInput = (overrides: Partial<CreateDeviceInput> = {}): CreateDeviceInput => ({
  deviceType: 'Laptop',
  model: 'Dell XPS 13',
  serialNumber: `SN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  status: 'In Stock',
  assignedTo: null,
  department: null,
  purchaseDate: null,
  warrantyExpiry: null,
  notes: null,
  ...overrides,
});

const historyFor = async (deviceId: number) => {
  const [rows] = await pool.query<any[]>(
    'SELECT action_type, condition_state, ticket_id FROM device_history WHERE device_id = ? ORDER BY id',
    [deviceId],
  );
  return rows;
};

beforeEach(async () => {
  // device_history/mac_addresses cascade from devices.
  await pool.query('DELETE FROM device_history');
  await pool.query('DELETE FROM ticket_device_links');
  await pool.query('DELETE FROM mac_addresses');
  await pool.query('DELETE FROM devices');
  await pool.query('DELETE FROM device_sequence');
});

afterAll(async () => {
  await pool.end();
});

describe('deviceRepo.create', () => {
  it('persists the device and returns it fully hydrated', async () => {
    const device = await deviceRepo.create(baseInput({ serialNumber: 'SN-CREATE-1' }));

    expect(device.id).toBeGreaterThan(0);
    expect(device.serialNumber).toBe('SN-CREATE-1');
    expect(device.code).toMatch(/^ITA-\d{4}-\d{4}$/);

    const [rows] = await pool.query<any[]>('SELECT * FROM devices WHERE id = ?', [device.id]);
    expect(rows).toHaveLength(1);
  });

  it('writes the six spec columns that had no migration until 2026-07-13', async () => {
    // This is the exact INSERT that hard-failed with "Unknown column 'cpu'" on any
    // DB that never re-ran init/03. If the columns regress, this test dies here.
    const device = await deviceRepo.create(
      baseInput({
        serialNumber: 'SN-SPECS-1',
        specifications: { cpu: 'i7-1165G7', ramGb: 16, storageGb: 512, gpu: 'Iris Xe', psuWatts: 65 },
      }),
    );
    expect(device.specifications?.cpu).toBe('i7-1165G7');
    expect(device.specifications?.ramGb).toBe(16);
  });

  it('stores MAC addresses supplied at create time', async () => {
    const device = await deviceRepo.create(
      baseInput({
        serialNumber: 'SN-MAC-1',
        macAddresses: [{ macType: 'WiFi', macAddress: 'AA:BB:CC:DD:EE:01' }],
      }),
    );
    expect(device.macAddresses).toHaveLength(1);
    expect(device.macAddresses?.[0].macType).toBe('WiFi');
  });

  it('rejects a duplicate serial number at the DB level', async () => {
    await deviceRepo.create(baseInput({ serialNumber: 'SN-DUP' }));
    // The UNIQUE key is the real guard — the pre-check is racy. A duplicate must
    // surface as ER_DUP_ENTRY (which the error middleware maps to 409), never as
    // a second row.
    await expect(deviceRepo.create(baseInput({ serialNumber: 'SN-DUP' }))).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });

    const [rows] = await pool.query<any[]>('SELECT id FROM devices WHERE serial_number = ?', ['SN-DUP']);
    expect(rows).toHaveLength(1);
  });
});

describe('deviceRepo device-code counter (SELECT ... FOR UPDATE)', () => {
  it('never issues the same code twice under concurrent creates', async () => {
    // The counter is the one piece of genuinely concurrent logic in the codebase.
    // Serial execution would pass even if the lock were removed; this will not.
    const created = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        deviceRepo.create(baseInput({ serialNumber: `SN-RACE-${i}` })),
      ),
    );

    const codes = created.map((d) => d.code);
    expect(new Set(codes).size).toBe(10);
  });
});

describe('deviceRepo.assignToUser', () => {
  it('assigns the device, flips it to Active, and logs an audit row', async () => {
    const device = await deviceRepo.create(baseInput({ serialNumber: 'SN-ASSIGN' }));

    const updated = await deviceRepo.assignToUser(
      device.id,
      null,
      'Alex Mercer',
      'alex@company.com',
      'Engineering',
    );

    expect(updated.status).toBe('Active');
    expect(updated.assignedTo).toContain('Alex Mercer');

    const history = await historyFor(device.id);
    expect(history.map((h) => h.action_type)).toEqual(['assigned']);
  });
});

describe('deviceRepo.checkout', () => {
  it('logs BOTH a return and a repair when a damaged device is checked in', async () => {
    // A checkout into In Repair is two events. Logging only 'returned' is why the
    // stock-movement report's `repaired` column was permanently zero.
    const device = await deviceRepo.create(baseInput({ serialNumber: 'SN-CHECKOUT-1' }));
    await deviceRepo.assignToUser(device.id, null, 'Bob', 'bob@company.com', 'IT');

    const returned = await deviceRepo.checkout(device.id, 'damaged', 'In Repair', 'cracked screen');

    expect(returned.status).toBe('In Repair');
    expect(returned.assignedTo).toBeNull();

    const actions = (await historyFor(device.id)).map((h) => h.action_type);
    expect(actions).toEqual(['assigned', 'returned', 'repaired']);
  });

  it('logs only a return when a healthy device goes back to stock', async () => {
    const device = await deviceRepo.create(baseInput({ serialNumber: 'SN-CHECKOUT-2' }));
    await deviceRepo.assignToUser(device.id, null, 'Bob', 'bob@company.com', 'IT');

    await deviceRepo.checkout(device.id, 'good', 'In Stock');

    const actions = (await historyFor(device.id)).map((h) => h.action_type);
    // 'In Stock' must NOT produce a second row — checkout already logged the return.
    expect(actions).toEqual(['assigned', 'returned']);
  });
});

describe('deviceRepo.getStockMovementReport', () => {
  it('counts a repair that arrived through checkout', async () => {
    const device = await deviceRepo.create(baseInput({ serialNumber: 'SN-REPORT-1' }));
    await deviceRepo.assignToUser(device.id, null, 'Bob', 'bob@company.com', 'IT');
    await deviceRepo.checkout(device.id, 'damaged', 'In Repair');

    const report = await deviceRepo.getStockMovementReport();
    const today = report[0];

    expect(Number(today.assigned)).toBe(1);
    expect(Number(today.returned)).toBe(1);
    expect(Number(today.repaired)).toBe(1); // was structurally always 0
  });
});
