import type { PoolConnection } from 'mysql2/promise';
import { withTransaction } from '../config/db.js';
import { approvalRepo, mapApproval, type TicketApprovalRow } from '../models/approval.repo.js';
import * as engine from './approval.engine.js';
import { AppError } from '../utils/AppError.js';
import type { JwtPayload } from '../types/index.js';

function toEngineSteps(rows: TicketApprovalRow[]): engine.ApprovalStep[] {
  return rows.map((r) => ({
    stepOrder: r.step_order,
    status: r.status,
    approverUserId: r.approver_user_id,
  }));
}

/** Notify whoever must act on the current active step (or admins if unassigned). */
async function notifyActive(
  conn: PoolConnection,
  ticketId: number,
  rows: TicketApprovalRow[],
): Promise<void> {
  const active = engine.activeStep(toEngineSteps(rows));
  if (!active) return;
  if (active.approverUserId) {
    await approvalRepo.enqueueNotification(
      { event: 'approval_requested', recipientUserId: active.approverUserId, ticketId, payload: { stepOrder: active.stepOrder } },
      conn,
    );
  } else {
    // No-deadlock: an unresolved step pings admins to assign an approver.
    await approvalRepo.enqueueNotification(
      { event: 'approval_unassigned', ticketId, payload: { stepOrder: active.stepOrder } },
      conn,
    );
  }
}

export const approvalService = {
  /** Materialize the default chain for a new ticket (no-op if approval is off). */
  async startApproval(ticketId: number, requesterDept: string): Promise<void> {
    if (!(await approvalRepo.isApprovalEnabled())) return;
    await withTransaction(async (conn) => {
      const existing = await approvalRepo.getChain(ticketId, conn);
      if (existing.length > 0) return; // idempotent
      const rows = await approvalRepo.instantiate(ticketId, requesterDept, conn);
      await notifyActive(conn, ticketId, rows);
    });
  },

  async getChain(ticketId: number) {
    return (await approvalRepo.getChain(ticketId)).map(mapApproval);
  },

  /** Approve or reject the active step; advance/reject the ticket accordingly. */
  async decide(
    ticketId: number,
    stepOrder: number,
    decision: engine.Decision,
    user: JwtPayload,
    note: string | null,
  ) {
    return withTransaction(async (conn) => {
      const rows = await approvalRepo.getChain(ticketId, conn);
      if (rows.length === 0) throw AppError.badRequest('This ticket has no approval chain');

      const steps = toEngineSteps(rows);
      const active = engine.activeStep(steps);
      if (!active || active.stepOrder !== stepOrder) {
        throw AppError.badRequest('That step is not the active approval step');
      }

      const meta = await approvalRepo.getTicketMeta(ticketId, conn);
      const uid = Number(user.sub);
      const isAssigned = active.approverUserId != null && active.approverUserId === uid;
      const isUnassigned = active.approverUserId == null;
      const isPrivileged = user.role === 'admin' || user.role === 'it_support';
      // Named approvers are binding (separation of duties). it_support/admin may
      // only act on UNASSIGNED steps (the no-deadlock fallback); to act on a step
      // assigned to someone else they must reassign it first (audited).
      if (!isAssigned && !(isPrivileged && isUnassigned)) {
        throw AppError.forbidden('This step is assigned to another approver');
      }
      // Self-approval guard anchored to the requester_id captured from the JWT at
      // creation — NOT the body-supplied requester_email, which can be spoofed to
      // slip a self-filed request past this check.
      if (meta && meta.requester_id != null && meta.requester_id === uid) {
        throw AppError.forbidden('You cannot approve your own request');
      }

      const { ticketAction } = engine.applyDecision(steps, stepOrder, decision);
      const status = decision === 'approve' ? 'approved' : 'rejected';
      const affected = await approvalRepo.decideStep(ticketId, stepOrder, status, uid, note, conn);
      if (affected === 0) {
        // Lost a concurrent race — the step was already decided.
        throw AppError.conflict('This step has already been decided');
      }

      const requesterEmail = meta?.requester_email ?? null;
      if (ticketAction === 'advance') {
        await approvalRepo.setTicketStatus(ticketId, 'waiting', 'Approved — awaiting fulfillment', user.name, conn);
        await approvalRepo.enqueueNotification({ event: 'approval_completed', ticketId, recipientEmail: requesterEmail }, conn);
      } else if (ticketAction === 'reject') {
        await approvalRepo.setTicketStatus(ticketId, 'rejected', 'Rejected in approval', user.name, conn);
        await approvalRepo.enqueueNotification(
          { event: 'approval_rejected', ticketId, recipientEmail: requesterEmail, payload: { by: user.name, note } },
          conn,
        );
      } else {
        await notifyActive(conn, ticketId, await approvalRepo.getChain(ticketId, conn));
      }

      const chain = (await approvalRepo.getChain(ticketId, conn)).map(mapApproval);
      return { ticketAction, chain };
    });
  },

  /** Admin/it assigns an approver to an unresolved pending step. */
  async assignApprover(ticketId: number, stepOrder: number, userId: number) {
    await withTransaction(async (conn) => {
      await approvalRepo.assignApprover(ticketId, stepOrder, userId, conn);
      await approvalRepo.enqueueNotification(
        { event: 'approval_requested', recipientUserId: userId, ticketId, payload: { stepOrder } },
        conn,
      );
    });
    return (await approvalRepo.getChain(ticketId)).map(mapApproval);
  },

  async pendingForUser(userId: number) {
    return approvalRepo.pendingForUser(userId);
  },

  /** True while the chain is still in progress (blocks manual resolve). */
  async isPending(ticketId: number, conn?: PoolConnection): Promise<boolean> {
    const rows = await approvalRepo.getChain(ticketId, conn);
    return engine.chainState(toEngineSteps(rows)) === 'in_progress';
  },

  /** Open mode: insert an extra signer after `afterStep` into a live chain. */
  async addSigner(ticketId: number, afterStep: number, userId: number) {
    return withTransaction(async (conn) => {
      const rows = await approvalRepo.getChain(ticketId, conn);
      if (rows.length === 0) throw AppError.badRequest('This ticket has no approval chain');
      // Only mutate a live chain — inserting into an already approved/rejected
      // chain could drive a settled ticket back to 'rejected' (H-5).
      if (engine.chainState(toEngineSteps(rows)) !== 'in_progress') {
        throw AppError.conflict('Approval chain is already complete');
      }
      if (!rows.some((r) => r.step_order === afterStep)) {
        throw AppError.badRequest('afterStep must be an existing step');
      }
      await approvalRepo.insertSigner(ticketId, afterStep, userId, null, conn);
      await notifyActive(conn, ticketId, await approvalRepo.getChain(ticketId, conn));
      return (await approvalRepo.getChain(ticketId, conn)).map(mapApproval);
    });
  },

  /** Admin: read the default flow + leader resolution settings. */
  async getConfig() {
    const [steps, departmentLeaders, itLeader, enabled] = await Promise.all([
      approvalRepo.getDefaultFlowSteps(),
      approvalRepo.listDepartmentLeaders(),
      approvalRepo.getSetting('it_leader_user_id'),
      approvalRepo.getSetting('approval_enabled'),
    ]);
    return {
      steps: steps.map((s) => ({
        stepOrder: s.step_order,
        approverType: s.approver_type,
        approverUserId: s.approver_user_id,
        label: s.label,
      })),
      departmentLeaders,
      itLeaderUserId: itLeader ? Number(itLeader) : null,
      approvalEnabled: enabled === '1',
    };
  },

  /** Admin: update the default flow steps + leader settings. */
  async updateConfig(input: {
    steps?: Array<{ approverType: 'requester_leader' | 'it_leader' | 'user' | 'role'; approverUserId?: number | null; label?: string | null }>;
    itLeaderUserId?: number | null;
    approvalEnabled?: boolean;
    departmentLeaders?: Array<{ department: string; leaderUserId: number | null }>;
  }) {
    await withTransaction(async (conn) => {
      if (input.steps) await approvalRepo.replaceDefaultFlowSteps(input.steps, conn);
      if (input.itLeaderUserId !== undefined) {
        await approvalRepo.setSetting(
          'it_leader_user_id',
          input.itLeaderUserId == null ? '' : String(input.itLeaderUserId),
          conn,
        );
      }
      if (input.approvalEnabled !== undefined) {
        await approvalRepo.setSetting('approval_enabled', input.approvalEnabled ? '1' : '0', conn);
      }
      for (const dl of input.departmentLeaders ?? []) {
        if (dl.leaderUserId == null) await approvalRepo.removeDepartmentLeader(dl.department, conn);
        else await approvalRepo.setDepartmentLeader(dl.department, dl.leaderUserId, conn);
      }
    });
    return this.getConfig();
  },
};
