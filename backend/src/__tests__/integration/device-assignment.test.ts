import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import type { Request, Response } from 'express';
import type { ResultSetHeader } from 'mysql2';
import { pool } from '../../config/db.js';
import { deviceController } from '../../controllers/device.controller.js';
import { deviceRepo, type CreateDeviceInput } from '../../models/device.repo.js';

/**
 * Custody as a record, not a string.
 *
 * `devices.assigned_to` was free text ('Alex Mercer (alex@company.com)') with no
 * foreign key, so the one question this module exists to answer — "what is
 * employee X holding?" — was a string match that broke silently on a rename. And
 * checkout() never recorded WHO returned a device, so a timeline read
 * "issued to A" -> "returned" -> "issued to B" with no way to tell who gave it
 * back. These tests pin both, against a real database.
 */

const baseInput = (over: Partial<CreateDeviceInput> = {}): CreateDeviceInput => ({
  deviceType: 'Laptop',
  model: 'Dell XPS 13',
  serialNumber: `SN-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
  status: 'In Stock',
  department: null,
  purchaseDate: null,
  warrantyExpiry: null,
  notes: null,
  ...over,
});

/** A real user row to hand devices to — the whole point is the foreign key. */
const aUser = async (email: string) => {
  await pool.query('DELETE FROM users WHERE email = ?', [email]);
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO users (full_name, email, password_hash, role, department, is_active)
     VALUES (?, ?, '$2a$10$x', 'requester', 'Engineering', 1)`,
    [`User ${email}`, email],
  );
  return Number(res.insertId);
};

beforeEach(async () => {
  await pool.query('DELETE FROM device_assignments');
  await pool.query('DELETE FROM device_history');
  await pool.query('DELETE FROM ticket_device_links');
  await pool.query('DELETE FROM mac_addresses');
  await pool.query('DELETE FROM devices');
  await pool.query('DELETE FROM device_sequence');
});

afterAll(async () => {
  await pool.query("DELETE FROM users WHERE email LIKE 'custody%@test.local'");
  await pool.end();
});

describe('asset_code', () => {
  it('accepts a finance asset tag alongside the serial', async () => {
    const d = await deviceRepo.create(baseInput({ assetCode: 'FA-000123' }));
    expect(d.assetCode).toBe('FA-000123');
    expect(d.code).toMatch(/^ITA-/); // our own code is a separate identifier
  });

  it('lets many devices stay untagged, but rejects a duplicate tag', async () => {
    // Untagged is the normal state at intake — accounting tags hardware later.
    // A UNIQUE column would collide on the second untagged device if '' were
    // stored, so an empty tag must land as NULL.
    await deviceRepo.create(baseInput({ assetCode: null }));
    await deviceRepo.create(baseInput({ assetCode: '' }));
    await deviceRepo.create(baseInput());

    const [rows] = await pool.query<any[]>('SELECT COUNT(*) AS n FROM devices WHERE asset_code IS NULL');
    expect(Number(rows[0].n)).toBe(3);

    await deviceRepo.create(baseInput({ assetCode: 'FA-DUP' }));
    await expect(deviceRepo.create(baseInput({ assetCode: 'FA-DUP' }))).rejects.toMatchObject({
      code: 'ER_DUP_ENTRY',
    });
  });
});

describe('PC configuration', () => {
  it('stores the filterable specs as columns so they can be queried', async () => {
    await deviceRepo.create(
      baseInput({
        specifications: { ramGb: 4, storageGb: 256, storageType: 'SSD', os: 'Windows', osVersion: '10', hostname: 'PC-001' },
      }),
    );
    await deviceRepo.create(baseInput({ specifications: { ramGb: 32, os: 'Windows', osVersion: '11' } }));

    // The queries that justify these being columns rather than JSON.
    const [low] = await pool.query<any[]>('SELECT code FROM devices WHERE ram_gb < 8');
    expect(low).toHaveLength(1);

    const [win10] = await pool.query<any[]>("SELECT code FROM devices WHERE os = 'Windows' AND os_version = '10'");
    expect(win10).toHaveLength(1);
  });
});

describe('assignment', () => {
  it('links the device to a real user id, not a name string', async () => {
    const userId = await aUser('custody1@test.local');
    const d = await deviceRepo.create(baseInput());

    await deviceRepo.assignToUser(d.id, userId, 'Alex Mercer', 'custody1@test.local', 'Engineering');

    const held = await deviceRepo.listOpenAssignmentsByUser(userId);
    expect(held).toHaveLength(1);
    expect(held[0].deviceCode).toBe(d.code);
    expect(held[0].userId).toBe(userId);

    // The denormalized pointer must agree with the record.
    const [rows] = await pool.query<any[]>('SELECT assigned_user_id, status FROM devices WHERE id = ?', [d.id]);
    expect(rows[0].assigned_user_id).toBe(userId);
    expect(rows[0].status).toBe('Active');
  });

  it('refuses to re-issue a device somebody still has', async () => {
    const a = await aUser('custody2@test.local');
    const b = await aUser('custody3@test.local');
    const d = await deviceRepo.create(baseInput());

    await deviceRepo.assignToUser(d.id, a, 'A', 'custody2@test.local', 'Eng');

    // Silently transferring would erase the fact that A never gave it back.
    await expect(
      deviceRepo.assignToUser(d.id, b, 'B', 'custody3@test.local', 'Eng'),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await deviceRepo.listOpenAssignmentsByUser(a)).toHaveLength(1);
    expect(await deviceRepo.listOpenAssignmentsByUser(b)).toHaveLength(0);
  });

  it('cannot be issued to two people at once, even under a real race', async () => {
    // The sequential test above passes on the app-level SELECT-then-INSERT check
    // alone — it would still be green with the UNIQUE index dropped entirely.
    // Two concurrent calls can both clear that SELECT before either commits, so
    // only the index can decide. Assert on END STATE, not on which error shape
    // wins: that part is genuinely racy.
    const a = await aUser('custody9@test.local');
    const b = await aUser('custody10@test.local');
    const d = await deviceRepo.create(baseInput());

    const results = await Promise.allSettled([
      deviceRepo.assignToUser(d.id, a, 'A', 'custody9@test.local', 'Eng'),
      deviceRepo.assignToUser(d.id, b, 'B', 'custody10@test.local', 'Sales'),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const [rows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS n FROM device_assignments WHERE device_id = ? AND returned_at IS NULL',
      [d.id],
    );
    expect(Number(rows[0].n)).toBe(1);

    const held =
      (await deviceRepo.listOpenAssignmentsByUser(a)).length +
      (await deviceRepo.listOpenAssignmentsByUser(b)).length;
    expect(held).toBe(1);
  });
});

describe('custody has exactly one door', () => {
  it('device create cannot set a holder', async () => {
    // The device form used to write devices.assigned_to as free text, straight
    // past device_assignments — so a device could be "assigned" with no hand-over
    // row, the conflict guard would see nothing, and the next assignment would
    // overwrite the first holder with no return event and no audit trail.
    // CreateDeviceInput no longer has the field at all; this pins that it stays gone.
    const d = await deviceRepo.create(baseInput());

    const [rows] = await pool.query<any[]>(
      'SELECT assigned_to, assigned_user_id FROM devices WHERE id = ?',
      [d.id],
    );
    expect(rows[0].assigned_to).toBeNull();
    expect(rows[0].assigned_user_id).toBeNull();
    expect(await deviceRepo.getAssignmentHistory(d.id)).toHaveLength(0);
  });

  it('device update cannot change the holder out from under the record', async () => {
    const userId = await aUser('custody11@test.local');
    const d = await deviceRepo.create(baseInput());
    await deviceRepo.assignToUser(d.id, userId, 'A', 'custody11@test.local', 'Eng');

    // An edit touching other fields must leave custody exactly where it was.
    await deviceRepo.update(d.id, { notes: 'edited', model: 'New Model' });

    const [rows] = await pool.query<any[]>(
      'SELECT assigned_user_id FROM devices WHERE id = ?',
      [d.id],
    );
    expect(rows[0].assigned_user_id).toBe(userId);
    expect(await deviceRepo.listOpenAssignmentsByUser(userId)).toHaveLength(1);
  });
});

describe('the assign endpoint resolves the account itself', () => {
  /** Minimal Express doubles — the controller only ever calls res.json(). */
  const fakeRes = () => {
    const captured: { body?: any } = {};
    const res = { json: (b: any) => ((captured.body = b), res) } as unknown as Response;
    return { res, captured };
  };

  it('writes a real user_id even when the caller sends none', async () => {
    // THE bug this whole feature nearly died of: api.assignDevice() had no userId
    // parameter, so no caller could send one; the schema made it optional; and the
    // controller did `userId || null`. Every assignment through the UI therefore
    // wrote NULL — manufacturing the exact orphan rows the backfill exists to flag.
    // The server now resolves the account from the email, which fixes every caller
    // at once and cannot be forgotten by the next one.
    const userId = await aUser('custody13@test.local');
    const d = await deviceRepo.create(baseInput());

    const { res, captured } = fakeRes();
    await deviceController.assignToUser(
      {
        params: { id: String(d.id) },
        body: { userName: 'Alex', userEmail: 'custody13@test.local', userDept: 'Eng' }, // no userId
        user: { name: 'IT Bob' },
      } as unknown as Request,
      res,
    );

    expect(captured.body.device.assignedUserId).toBe(userId);

    const held = await deviceRepo.listOpenAssignmentsByUser(userId);
    expect(held).toHaveLength(1);
    expect(held[0].userId).toBe(userId); // not NULL
  });

  it('refuses to issue a device to an email with no account', async () => {
    // Better a loud 400 than a silent NULL that quietly becomes somebody's problem
    // to reconcile by hand on an airgapped box.
    const d = await deviceRepo.create(baseInput());
    const { res } = fakeRes();

    await expect(
      deviceController.assignToUser(
        {
          params: { id: String(d.id) },
          body: { userName: 'Ghost', userEmail: 'nobody@test.local' },
          user: { name: 'IT Bob' },
        } as unknown as Request,
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await deviceRepo.getAssignmentHistory(d.id)).toHaveLength(0);
  });
});

describe('resolving a backfilled row', () => {
  it('points an unresolved hand-over at a real account', async () => {
    // The backfill refused to guess who 'Alice Tan' was, so the row carries
    // user_id = NULL. Without a way to close these out, the migration lands on an
    // airgapped box with orphan rows and nothing but raw SQL to fix them.
    const d = await deviceRepo.create(baseInput());
    await pool.query(
      `INSERT INTO device_assignments (device_id, user_id, user_label, assigned_by)
       VALUES (?, NULL, 'Alice Tan', 'System (backfill)')`,
      [d.id],
    );

    const unresolved = await deviceRepo.listUnresolvedAssignments();
    expect(unresolved).toHaveLength(1);
    expect(unresolved[0].userId).toBeNull();

    const userId = await aUser('custody12@test.local');
    await deviceRepo.resolveAssignmentUser(unresolved[0].id, userId, 'custody12@test.local');

    expect(await deviceRepo.listUnresolvedAssignments()).toHaveLength(0);
    expect(await deviceRepo.listOpenAssignmentsByUser(userId)).toHaveLength(1);

    const [rows] = await pool.query<any[]>('SELECT assigned_user_id FROM devices WHERE id = ?', [d.id]);
    expect(rows[0].assigned_user_id).toBe(userId);
  });
});

describe('return to stock', () => {
  it('closes the hand-over and records WHO returned it', async () => {
    const userId = await aUser('custody4@test.local');
    const d = await deviceRepo.create(baseInput());
    await deviceRepo.assignToUser(d.id, userId, 'Alex Mercer', 'custody4@test.local', 'Engineering');

    await deviceRepo.checkout(d.id, 'good', 'In Stock', 'looks fine', 'IT Bob');

    // No longer held by anyone...
    expect(await deviceRepo.listOpenAssignmentsByUser(userId)).toHaveLength(0);

    // ...but the custody trail remembers the whole episode.
    const history = await deviceRepo.getAssignmentHistory(d.id);
    expect(history).toHaveLength(1);
    expect(history[0].userId).toBe(userId);
    expect(history[0].returnedAt).not.toBeNull();
    expect(history[0].returnedCondition).toBe('good');
    expect(history[0].returnedBy).toBe('IT Bob');

    // And the device_history 'returned' row now names the holder it came back
    // from — it used to record nothing but the IT operator who pressed the button.
    const [rows] = await pool.query<any[]>(
      "SELECT assigned_to FROM device_history WHERE device_id = ? AND action_type = 'returned'",
      [d.id],
    );
    expect(rows[0].assigned_to).toContain('custody4@test.local');
  });

  it('puts the device straight back in the issuable pool', async () => {
    const userId = await aUser('custody5@test.local');
    const d = await deviceRepo.create(baseInput());
    await deviceRepo.assignToUser(d.id, userId, 'A', 'custody5@test.local', 'Eng');
    await deviceRepo.checkout(d.id, 'good', 'In Stock');

    const [rows] = await pool.query<any[]>('SELECT status, assigned_user_id FROM devices WHERE id = ?', [d.id]);
    expect(rows[0].status).toBe('In Stock');
    expect(rows[0].assigned_user_id).toBeNull();
  });

  it('can be re-issued to the next person, and both custody periods survive', async () => {
    const a = await aUser('custody6@test.local');
    const b = await aUser('custody7@test.local');
    const d = await deviceRepo.create(baseInput());

    await deviceRepo.assignToUser(d.id, a, 'A', 'custody6@test.local', 'Eng');
    await deviceRepo.checkout(d.id, 'good', 'In Stock');
    await deviceRepo.assignToUser(d.id, b, 'B', 'custody7@test.local', 'Sales');

    const history = await deviceRepo.getAssignmentHistory(d.id);
    expect(history).toHaveLength(2);

    const open = history.filter((h) => h.returnedAt === null);
    expect(open).toHaveLength(1);
    expect(open[0].userId).toBe(b);

    expect(await deviceRepo.listOpenAssignmentsByUser(a)).toHaveLength(0);
    expect(await deviceRepo.listOpenAssignmentsByUser(b)).toHaveLength(1);
  });

  it('a damaged return goes to repair, not back into the pool', async () => {
    const userId = await aUser('custody8@test.local');
    const d = await deviceRepo.create(baseInput());
    await deviceRepo.assignToUser(d.id, userId, 'A', 'custody8@test.local', 'Eng');

    await deviceRepo.checkout(d.id, 'damaged', 'In Repair', 'cracked screen');

    const [rows] = await pool.query<any[]>('SELECT status FROM devices WHERE id = ?', [d.id]);
    expect(rows[0].status).toBe('In Repair');

    const history = await deviceRepo.getAssignmentHistory(d.id);
    expect(history[0].returnedCondition).toBe('damaged');
  });
});
