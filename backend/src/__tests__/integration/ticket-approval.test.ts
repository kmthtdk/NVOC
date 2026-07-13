import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { pool } from '../../config/db.js';
import { ticketRepo, type CreateTicketInput } from '../../models/ticket.repo.js';
import { approvalRepo } from '../../models/approval.repo.js';
import { approvalService } from '../../services/approval.service.js';

/**
 * The approval gate, executed for real.
 *
 * approval.service was unit-tested with mocked repos, so the SQL that actually
 * moves a ticket between states — instantiate(), setTicketStatus()'s new
 * FOR UPDATE + assertTransition, the pending_approval write in ticketRepo.create
 * — had never run under test.
 */

const setApprovalEnabled = async (on: boolean) => {
  await pool.query(
    `INSERT INTO app_settings (setting_key, setting_value) VALUES ('approval_enabled', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
    [on ? '1' : '0'],
  );
};

const baseTicket = (overrides: Partial<CreateTicketInput> = {}): CreateTicketInput => ({
  title: 'Need a laptop',
  description: 'Mine died',
  requesterId: null,
  requesterName: 'Alex Mercer',
  requesterEmail: 'alex.mercer@company.com',
  // The seeded department_leaders row covers this department only; any other
  // value resolves step 1 to an UNASSIGNED approver and the chain behaves
  // differently. Naming it here keeps the fixture honest about that dependency.
  requesterDept: 'R&D / Software Engineering',
  category: 'general_request',
  subcategory: 'troubleshooting',
  type: 'office',
  priority: 'medium',
  assignedTo: 'Unassigned',
  periodFrom: null,
  periodTo: null,
  details: {},
  ...overrides,
});

const statusOf = async (ticketId: number): Promise<string> => {
  const [rows] = await pool.query<any[]>('SELECT status FROM tickets WHERE id = ?', [ticketId]);
  return rows[0]?.status;
};

const historyOf = async (ticketId: number): Promise<string[]> => {
  const [rows] = await pool.query<any[]>(
    'SELECT status FROM ticket_history WHERE ticket_id = ? ORDER BY id',
    [ticketId],
  );
  return rows.map((r) => r.status);
};

beforeEach(async () => {
  await pool.query('DELETE FROM ticket_approvals');
  await pool.query('DELETE FROM notifications');
  await pool.query('DELETE FROM ticket_history');
  await pool.query('DELETE FROM comments');
  await pool.query('DELETE FROM ticket_device_links');
  await pool.query('DELETE FROM tickets');
  await pool.query('DELETE FROM ticket_sequence');
});

afterAll(async () => {
  await pool.end();
});

describe('ticket creation without approval', () => {
  it('goes straight to submitted when the approval gate is off', async () => {
    await setApprovalEnabled(false);

    const ticket = await ticketRepo.create(baseTicket());

    expect(ticket.status).toBe('submitted');
    expect(await approvalRepo.getChain(Number(ticket.id))).toHaveLength(0);
  });

  it('generates a unique code per ticket under concurrent creates', async () => {
    await setApprovalEnabled(false);

    const tickets = await Promise.all(
      Array.from({ length: 8 }, (_, i) => ticketRepo.create(baseTicket({ title: `T${i}` }))),
    );
    expect(new Set(tickets.map((t) => t.code)).size).toBe(8);
  });
});

describe('ticket creation with approval enabled', () => {
  beforeEach(async () => {
    await setApprovalEnabled(true);
  });

  it('parks the ticket in pending_approval, not submitted', async () => {
    const ticket = await ticketRepo.create(baseTicket());

    // The whole point of the feature: a gated ticket must not look like a ticket
    // waiting on IT triage.
    expect(ticket.status).toBe('pending_approval');
    expect(await approvalRepo.getChain(Number(ticket.id)).then((c) => c.length)).toBeGreaterThan(0);
  });

  it('records the gate in the audit timeline', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    expect(await historyOf(Number(ticket.id))).toContain('pending_approval');
  });

  it('rolls the whole ticket back if the chain cannot be materialized', async () => {
    // A ticket with zero approval rows would silently bypass the gate, so the
    // chain is built inside the ticket's own transaction. Break the chain table
    // and the ticket must not survive either.
    await pool.query('ALTER TABLE ticket_approvals RENAME TO ticket_approvals_hidden');
    try {
      await expect(ticketRepo.create(baseTicket({ title: 'should not exist' }))).rejects.toThrow();

      const [rows] = await pool.query<any[]>('SELECT id FROM tickets WHERE title = ?', [
        'should not exist',
      ]);
      expect(rows).toHaveLength(0);
    } finally {
      await pool.query('ALTER TABLE ticket_approvals_hidden RENAME TO ticket_approvals');
    }
  });
});

describe('approval decisions', () => {
  beforeEach(async () => {
    await setApprovalEnabled(true);
  });

  /** The seeded flow's first step resolves to the department leader (user id 2/3). */
  const firstApprover = async (ticketId: number) => {
    const chain = await approvalRepo.getChain(ticketId);
    const step = chain.find((s) => s.status === 'pending')!;
    return { step, userId: step.approver_user_id! };
  };

  it('advances a fully-approved ticket from pending_approval to waiting', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    const id = Number(ticket.id);

    const chain = await approvalRepo.getChain(id);
    // Approve every step in order, as the real approvers would.
    for (const step of chain) {
      const uid = step.approver_user_id!;
      await approvalService.decide(
        id,
        step.step_order,
        'approve',
        { sub: String(uid), role: 'requester', name: 'Leader', email: `leader${uid}@company.com` } as any,
        null,
      );
    }

    expect(await statusOf(id)).toBe('waiting');
    expect(await historyOf(id)).toEqual(['submitted', 'pending_approval', 'waiting']);
  });

  it('rejects the ticket when an approver says no', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    const id = Number(ticket.id);
    const { step, userId } = await firstApprover(id);

    await approvalService.decide(
      id,
      step.step_order,
      'reject',
      { sub: String(userId), role: 'requester', name: 'Leader', email: 'leader@company.com' } as any,
      'Budget frozen',
    );

    expect(await statusOf(id)).toBe('rejected');
  });

  it('blocks a stranger from deciding somebody else\'s step', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    const id = Number(ticket.id);
    const { step } = await firstApprover(id);

    await expect(
      approvalService.decide(
        id,
        step.step_order,
        'approve',
        { sub: '999', role: 'requester', name: 'Nobody', email: 'nobody@company.com' } as any,
        null,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(await statusOf(id)).toBe('pending_approval');
  });

  it('loses the race safely when the same step is decided twice', async () => {
    const ticket = await ticketRepo.create(baseTicket());
    const id = Number(ticket.id);
    const { step, userId } = await firstApprover(id);

    const user = {
      sub: String(userId),
      role: 'requester',
      name: 'Leader',
      email: 'leader@company.com',
    } as any;

    const results = await Promise.allSettled([
      approvalService.decide(id, step.step_order, 'approve', user, null),
      approvalService.decide(id, step.step_order, 'approve', user, null),
    ]);

    // Exactly one decision may land; the loser must be told, not silently dropped.
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    expect(fulfilled).toHaveLength(1);

    const [rows] = await pool.query<any[]>(
      'SELECT COUNT(*) AS n FROM ticket_approvals WHERE ticket_id = ? AND step_order = ? AND status = ?',
      [id, step.step_order, 'approved'],
    );
    expect(Number(rows[0].n)).toBe(1);
  });
});
