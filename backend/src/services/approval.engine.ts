/**
 * Pure approval-chain logic — no DB, no I/O. The repo/service layer loads the
 * materialized `ticket_approvals` rows, calls these functions to decide the next
 * state, then persists. Keeping the decisions pure makes them unit-testable
 * (the DB isn't reachable from the dev host).
 */

export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped';
export type ChainState = 'in_progress' | 'approved' | 'rejected';
export type TicketAction = 'advance' | 'reject' | 'none';
export type Decision = 'approve' | 'reject';

export interface ApprovalStep {
  stepOrder: number;
  status: ApprovalStepStatus;
  /** Resolved approver; null means unassigned (leader not configured). */
  approverUserId: number | null;
}

/** Overall state of a chain. Empty chain = nothing to approve = approved. */
export function chainState(steps: ApprovalStep[]): ChainState {
  if (steps.length === 0) return 'approved';
  if (steps.some((s) => s.status === 'rejected')) return 'rejected';
  if (steps.every((s) => s.status === 'approved' || s.status === 'skipped')) return 'approved';
  return 'in_progress';
}

/** The first still-pending step by order — the one that may be decided now. */
export function activeStep(steps: ApprovalStep[]): ApprovalStep | null {
  return (
    [...steps].sort((a, b) => a.stepOrder - b.stepOrder).find((s) => s.status === 'pending') ?? null
  );
}

/** Sequential rule: only the active (first pending) step may be decided. */
export function canDecide(steps: ApprovalStep[], stepOrder: number): boolean {
  const active = activeStep(steps);
  return active !== null && active.stepOrder === stepOrder;
}

/**
 * Apply an approve/reject to the active step. Returns the new chain, its state,
 * and what the ticket should do (advance when fully approved, reject on any
 * rejection, else nothing). Throws if the step isn't the active one.
 */
export function applyDecision(
  steps: ApprovalStep[],
  stepOrder: number,
  decision: Decision,
): { steps: ApprovalStep[]; chainState: ChainState; ticketAction: TicketAction } {
  if (!canDecide(steps, stepOrder)) {
    throw new Error(`Step ${stepOrder} is not the active approval step`);
  }
  const nextSteps = steps.map((s) =>
    s.stepOrder === stepOrder
      ? { ...s, status: (decision === 'approve' ? 'approved' : 'rejected') as ApprovalStepStatus }
      : s,
  );
  const state = chainState(nextSteps);
  const ticketAction: TicketAction =
    state === 'approved' ? 'advance' : state === 'rejected' ? 'reject' : 'none';
  return { steps: nextSteps, chainState: state, ticketAction };
}

/**
 * Insert an ad-hoc signer (open mode) at `atOrder`, shifting existing steps at
 * or after that position down by one. The new step is pending.
 */
export function insertAdHoc(
  steps: ApprovalStep[],
  atOrder: number,
  approverUserId: number | null,
): ApprovalStep[] {
  const shifted = steps.map((s) =>
    s.stepOrder >= atOrder ? { ...s, stepOrder: s.stepOrder + 1 } : s,
  );
  const inserted: ApprovalStep = { stepOrder: atOrder, status: 'pending', approverUserId };
  return [...shifted, inserted].sort((a, b) => a.stepOrder - b.stepOrder);
}
