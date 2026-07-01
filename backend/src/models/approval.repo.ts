import type { PoolConnection } from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../config/db.js';
import { AppError } from '../utils/AppError.js';

export type ApproverType = 'requester_leader' | 'it_leader' | 'user' | 'role';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface TicketApprovalRow extends RowDataPacket {
  id: number;
  ticket_id: number;
  step_order: number;
  approver_type: ApproverType;
  approver_user_id: number | null;
  approver_label: string | null;
  status: ApprovalStatus;
  decided_by: number | null;
  decided_at: string | null;
  note: string | null;
  is_ad_hoc: number;
  created_at: string;
}

interface FlowStepRow extends RowDataPacket {
  step_order: number;
  approver_type: ApproverType;
  approver_user_id: number | null;
  approver_role: string | null;
  label: string | null;
}

interface TicketMetaRow extends RowDataPacket {
  requester_id: number | null;
  requester_email: string;
  requester_dept: string;
  status: string;
}

export interface NotificationInput {
  event: string;
  recipientUserId?: number | null;
  recipientEmail?: string | null;
  ticketId?: number | null;
  payload?: Record<string, unknown> | null;
}

export const approvalRepo = {
  async getSetting(key: string, conn?: PoolConnection): Promise<string | null> {
    const db = conn ?? pool;
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      [key],
    );
    return (rows[0]?.setting_value as string | undefined) ?? null;
  },

  async isApprovalEnabled(conn?: PoolConnection): Promise<boolean> {
    return (await this.getSetting('approval_enabled', conn)) === '1';
  },

  async getDepartmentLeader(dept: string, conn?: PoolConnection): Promise<number | null> {
    const db = conn ?? pool;
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT leader_user_id FROM department_leaders WHERE department = ? LIMIT 1',
      [dept],
    );
    return (rows[0]?.leader_user_id as number | undefined) ?? null;
  },

  /** Steps of the applicable flow. Only the global default flow for now. */
  async getDefaultFlowSteps(conn?: PoolConnection): Promise<FlowStepRow[]> {
    const db = conn ?? pool;
    const [rows] = await db.query<FlowStepRow[]>(
      `SELECT s.step_order, s.approver_type, s.approver_user_id, s.approver_role, s.label
         FROM approval_flow_steps s
         JOIN approval_flows f ON f.id = s.flow_id
        WHERE f.scope_type = 'default' AND f.is_active = 1
        ORDER BY s.step_order ASC`,
    );
    return rows;
  },

  /** Resolve a step's concrete approver user id (null when unassigned). */
  async resolveApprover(
    step: Pick<FlowStepRow, 'approver_type' | 'approver_user_id'>,
    requesterDept: string,
    conn: PoolConnection,
  ): Promise<number | null> {
    switch (step.approver_type) {
      case 'user':
        return step.approver_user_id ?? null;
      case 'requester_leader':
        return this.getDepartmentLeader(requesterDept, conn);
      case 'it_leader': {
        const v = await this.getSetting('it_leader_user_id', conn);
        return v ? Number(v) : null;
      }
      default:
        return null; // 'role' unsupported for now -> unassigned
    }
  },

  /** Materialize the default flow into ticket_approvals rows for a ticket. */
  async instantiate(
    ticketId: number,
    requesterDept: string,
    conn: PoolConnection,
  ): Promise<TicketApprovalRow[]> {
    const steps = await this.getDefaultFlowSteps(conn);
    for (const s of steps) {
      const approverUserId = await this.resolveApprover(s, requesterDept, conn);
      await conn.execute(
        `INSERT INTO ticket_approvals
           (ticket_id, step_order, approver_type, approver_user_id, approver_label, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [ticketId, s.step_order, s.approver_type, approverUserId, s.label],
      );
    }
    return this.getChain(ticketId, conn);
  },

  async getChain(ticketId: number, conn?: PoolConnection): Promise<TicketApprovalRow[]> {
    const db = conn ?? pool;
    const [rows] = await db.query<TicketApprovalRow[]>(
      'SELECT * FROM ticket_approvals WHERE ticket_id = ? ORDER BY step_order ASC',
      [ticketId],
    );
    return rows;
  },

  /** True if the user appears anywhere in this ticket's approval chain. */
  async isApprover(ticketId: number, userId: number, conn?: PoolConnection): Promise<boolean> {
    const db = conn ?? pool;
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT 1 FROM ticket_approvals WHERE ticket_id = ? AND approver_user_id = ? LIMIT 1',
      [ticketId, userId],
    );
    return rows.length > 0;
  },

  async decideStep(
    ticketId: number,
    stepOrder: number,
    status: ApprovalStatus,
    deciderId: number,
    note: string | null,
    conn: PoolConnection,
  ): Promise<number> {
    // `AND status = 'pending'` makes concurrent double-decisions safe: the loser
    // of a race matches 0 rows and the caller aborts (H-6).
    const [result] = await conn.execute(
      `UPDATE ticket_approvals
          SET status = ?, decided_by = ?, decided_at = NOW(), note = ?
        WHERE ticket_id = ? AND step_order = ? AND status = 'pending'`,
      [status, deciderId, note, ticketId, stepOrder],
    );
    return (result as { affectedRows: number }).affectedRows;
  },

  async assignApprover(
    ticketId: number,
    stepOrder: number,
    userId: number,
    conn?: PoolConnection,
  ): Promise<void> {
    const db = conn ?? pool;
    await db.execute(
      `UPDATE ticket_approvals SET approver_user_id = ?
        WHERE ticket_id = ? AND step_order = ? AND status = 'pending'`,
      [userId, ticketId, stepOrder],
    );
  },

  async getTicketMeta(ticketId: number, conn?: PoolConnection): Promise<TicketMetaRow | null> {
    const db = conn ?? pool;
    const [rows] = await db.query<TicketMetaRow[]>(
      'SELECT requester_id, requester_email, requester_dept, status FROM tickets WHERE id = ? LIMIT 1',
      [ticketId],
    );
    return rows[0] ?? null;
  },

  async setTicketStatus(
    ticketId: number,
    status: string,
    label: string,
    actor: string,
    conn: PoolConnection,
  ): Promise<void> {
    await conn.execute('UPDATE tickets SET status = ? WHERE id = ?', [status, ticketId]);
    await conn.execute(
      `INSERT INTO ticket_history (ticket_id, status, status_label, updated_by, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [ticketId, status, label, actor, 'Approval workflow'],
    );
  },

  /** Tickets currently awaiting the given user's approval (their inbox). */
  async pendingForUser(userId: number, conn?: PoolConnection): Promise<RowDataPacket[]> {
    const db = conn ?? pool;
    // A step is actionable for the user when it is pending, assigned to them, and
    // it is the lowest-order pending step of its ticket (their turn).
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT t.id, t.code, t.title, t.requester_name, t.category_id, t.created_at, ta.step_order
         FROM ticket_approvals ta
         JOIN tickets t ON t.id = ta.ticket_id
        WHERE ta.approver_user_id = ?
          AND ta.status = 'pending'
          AND t.status NOT IN ('resolved', 'rejected')
          AND ta.step_order = (
            SELECT MIN(ta2.step_order) FROM ticket_approvals ta2
             WHERE ta2.ticket_id = ta.ticket_id AND ta2.status = 'pending'
          )
        ORDER BY t.created_at ASC`,
      [userId],
    );
    return rows;
  },

  async enqueueNotification(n: NotificationInput, conn: PoolConnection): Promise<void> {
    await conn.execute(
      `INSERT INTO notifications (event, recipient_user_id, recipient_email, ticket_id, payload)
       VALUES (?, ?, ?, ?, ?)`,
      [
        n.event,
        n.recipientUserId ?? null,
        n.recipientEmail ?? null,
        n.ticketId ?? null,
        n.payload ? JSON.stringify(n.payload) : null,
      ],
    );
  },

  /** Insert an ad-hoc signer after a given step, shifting later steps down. */
  async insertSigner(
    ticketId: number,
    afterStepOrder: number,
    userId: number,
    label: string | null,
    conn: PoolConnection,
  ): Promise<number> {
    // Renumber highest-first so the unique (ticket_id, step_order) never collides.
    await conn.query(
      'UPDATE ticket_approvals SET step_order = step_order + 1 WHERE ticket_id = ? AND step_order > ? ORDER BY step_order DESC',
      [ticketId, afterStepOrder],
    );
    const newOrder = afterStepOrder + 1;
    await conn.execute(
      `INSERT INTO ticket_approvals
         (ticket_id, step_order, approver_type, approver_user_id, approver_label, status, is_ad_hoc)
       VALUES (?, ?, 'user', ?, ?, 'pending', 1)`,
      [ticketId, newOrder, userId, label],
    );
    return newOrder;
  },

  // ---- Admin configuration ----
  async setSetting(key: string, value: string, conn?: PoolConnection): Promise<void> {
    const db = conn ?? pool;
    await db.execute(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [key, value],
    );
  },

  async replaceDefaultFlowSteps(
    steps: Array<{ approverType: ApproverType; approverUserId?: number | null; label?: string | null }>,
    conn: PoolConnection,
  ): Promise<void> {
    const [flowRows] = await conn.query<RowDataPacket[]>(
      "SELECT id FROM approval_flows WHERE scope_type = 'default' LIMIT 1",
    );
    const flowId = flowRows[0]?.id as number | undefined;
    if (!flowId) throw AppError.internal('Default approval flow is missing — run the DB seed');
    await conn.execute('DELETE FROM approval_flow_steps WHERE flow_id = ?', [flowId]);
    let order = 1;
    for (const s of steps) {
      await conn.execute(
        `INSERT INTO approval_flow_steps (flow_id, step_order, approver_type, approver_user_id, label)
         VALUES (?, ?, ?, ?, ?)`,
        [flowId, order++, s.approverType, s.approverUserId ?? null, s.label ?? null],
      );
    }
  },

  async listDepartmentLeaders(conn?: PoolConnection): Promise<RowDataPacket[]> {
    const db = conn ?? pool;
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT dl.department, dl.leader_user_id, u.full_name AS leader_name
         FROM department_leaders dl LEFT JOIN users u ON u.id = dl.leader_user_id
        ORDER BY dl.department`,
    );
    return rows;
  },

  async setDepartmentLeader(dept: string, userId: number, conn?: PoolConnection): Promise<void> {
    const db = conn ?? pool;
    await db.execute(
      `INSERT INTO department_leaders (department, leader_user_id) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE leader_user_id = VALUES(leader_user_id)`,
      [dept, userId],
    );
  },

  async removeDepartmentLeader(dept: string, conn?: PoolConnection): Promise<void> {
    const db = conn ?? pool;
    await db.execute('DELETE FROM department_leaders WHERE department = ?', [dept]);
  },
};

/** Map a raw chain row to the API shape (camelCase). */
export function mapApproval(r: TicketApprovalRow) {
  return {
    stepOrder: r.step_order,
    approverType: r.approver_type,
    approverUserId: r.approver_user_id,
    approverLabel: r.approver_label,
    status: r.status,
    decidedBy: r.decided_by,
    decidedAt: r.decided_at,
    note: r.note,
    isAdHoc: r.is_ad_hoc === 1,
  };
}
