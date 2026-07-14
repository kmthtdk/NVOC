import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../../config/db.js';
import { ticketRepo, type CreateTicketInput } from '../../models/ticket.repo.js';
import { deviceRepo, type CreateDeviceInput } from '../../models/device.repo.js';

/**
 * Search by identifier.
 *
 * Both repositories searched with FULLTEXT ... AGAINST (NATURAL LANGUAGE MODE)
 * alone. Fulltext tokenises on word boundaries, so "GR-2026-0001" is not a word
 * and never matched; `code` was not even in the ticket index, and `asset_code`
 * — the number printed on the sticker — was in no index at all.
 *
 * The result: pasting a ticket reference into search returned nothing. These
 * tests pin the LIKE fallback, against a real database, because a passing
 * typecheck says nothing about what MySQL does with the query.
 */

const baseTicket = (over: Partial<CreateTicketInput> = {}): CreateTicketInput => ({
  title: 'Monitor flickers on the second output',
  description: 'The external display drops signal every few minutes.',
  requesterId: null,
  requesterName: 'Alex Mercer',
  requesterEmail: 'alex.mercer@company.com',
  requesterDept: 'R&D / Software Engineering',
  category: 'general_request',
  subcategory: 'troubleshooting',
  type: 'office',
  priority: 'medium',
  assignedTo: 'Unassigned',
  periodFrom: null,
  periodTo: null,
  details: {},
  ...over,
});

const baseDevice = (over: Partial<CreateDeviceInput> = {}): CreateDeviceInput => ({
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

const list = (q: string) => ticketRepo.list({ page: 1, pageSize: 20, sort: 'newest', q });
const listDevices = (q: string) => deviceRepo.list({ page: 1, pageSize: 20, sort: 'newest', q });

beforeEach(async () => {
  // Both tables, empty: the "% is a literal" assertions count rows, so a stray
  // ticket left by another suite would make them pass for the wrong reason.
  await pool.query('DELETE FROM ticket_approvals');
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM ticket_history');
  await pool.query('DELETE FROM comments');
  await pool.query('DELETE FROM device_history');
  await pool.query('DELETE FROM ticket_device_links');
  await pool.query('DELETE FROM mac_addresses');
  await pool.query('DELETE FROM devices');
  await pool.query('DELETE FROM device_sequence');
  await pool.query('DELETE FROM tickets');
  await pool.query('DELETE FROM ticket_sequence');
});

afterAll(async () => {
  await pool.end();
});

describe('ticket search', () => {
  it('finds a ticket by its full code — the thing anyone pastes into a search box', async () => {
    const ticket = await ticketRepo.create(baseTicket());

    const found = await list(ticket.code);

    expect(found.total).toBeGreaterThanOrEqual(1);
    expect(found.data.map((t) => t.id)).toContain(ticket.id);
  });

  it('finds a ticket by a fragment of its code', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    const fragment = ticket.code.slice(-4); // the sequence number alone

    const found = await list(fragment);

    expect(found.data.map((t) => t.id)).toContain(ticket.id);
  });

  it('still matches on words in the title (the fulltext path is not lost)', async () => {
    const ticket = await ticketRepo.create(baseTicket({ title: 'Keyboard replacement needed' }));

    const found = await list('replacement');

    expect(found.data.map((t) => t.id)).toContain(ticket.id);
  });

  it('treats % as a literal, not as "match everything"', async () => {
    await ticketRepo.create(baseTicket());

    const found = await list('%');

    // Without escaping, LIKE '%%%' matches every row in the table.
    expect(found.total).toBe(0);
  });

  it('treats _ as a literal, not as a single-character wildcard', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    // `_` matches any one character in LIKE. Unescaped, a code-shaped term with
    // an underscore where the hyphens are would match the real code — the quiet
    // over-match, as opposed to `%`'s loud one.
    const wildcarded = ticket.code.replace(/-/g, '_');

    const found = await list(wildcarded);

    expect(found.data.map((t) => t.id)).not.toContain(ticket.id);
  });

  it('does not leak another requester\'s ticket when the code matches', async () => {
    // The LIKE fallback is OR-ed *inside* parentheses and then AND-ed with the
    // requester filter. Lose the parentheses and the OR escapes the scope: every
    // requester sees every ticket whose code matches. This is the test that fails
    // if that ever happens.
    const mine = await ticketRepo.create(baseTicket({ requesterEmail: 'alex.mercer@company.com' }));
    const theirs = await ticketRepo.create(
      baseTicket({ requesterEmail: 'someone.else@company.com', title: 'Not yours' }),
    );

    const found = await ticketRepo.list({
      page: 1,
      pageSize: 20,
      sort: 'newest',
      q: theirs.code,
      requesterEmail: 'alex.mercer@company.com',
    });

    expect(found.data.map((t) => t.id)).not.toContain(theirs.id);
    expect(found.data.map((t) => t.id)).not.toContain(mine.id); // the code does not match mine either
  });

  it('still finds your OWN ticket when the search is requester-scoped', async () => {
    // The leak test above only asserts absence, so it would also pass if the
    // scoped query broke and returned nothing at all — a search that finds
    // nothing is "secure" and useless. This is its positive control.
    const mine = await ticketRepo.create(baseTicket({ requesterEmail: 'alex.mercer@company.com' }));
    await ticketRepo.create(baseTicket({ requesterEmail: 'someone.else@company.com' }));

    const found = await ticketRepo.list({
      page: 1,
      pageSize: 20,
      sort: 'newest',
      q: mine.code,
      requesterEmail: 'alex.mercer@company.com',
    });

    expect(found.data.map((t) => t.id)).toContain(mine.id);
  });
});

describe('device search', () => {
  it('finds a device by its asset code, which is in no fulltext index', async () => {
    const device = await deviceRepo.create(
      baseDevice({ assetCode: 'AST-2026-0042', serialNumber: 'SN-ASSET-1' }),
    );

    const found = await listDevices('AST-2026-0042');

    expect(found.data.map((d) => d.id)).toContain(device.id);
  });

  it('finds a device by a fragment of its serial number', async () => {
    const device = await deviceRepo.create(baseDevice({ serialNumber: 'SN-FRAGMENT-9911' }));

    const found = await listDevices('9911');

    expect(found.data.map((d) => d.id)).toContain(device.id);
  });

  it('finds a device by its generated code', async () => {
    const device = await deviceRepo.create(baseDevice({ serialNumber: 'SN-CODE-1' }));

    const found = await listDevices(device.code);

    expect(found.data.map((d) => d.id)).toContain(device.id);
  });

  it('treats % as a literal, not as "match everything"', async () => {
    await deviceRepo.create(baseDevice());

    const found = await listDevices('%');

    expect(found.data).toHaveLength(0);
  });

  it('treats _ as a literal, not as a single-character wildcard', async () => {
    const device = await deviceRepo.create(baseDevice({ serialNumber: 'SN-UNDERSCORE-1' }));

    const found = await listDevices('SN_UNDERSCORE_1');

    expect(found.data.map((d) => d.id)).not.toContain(device.id);
  });
});
