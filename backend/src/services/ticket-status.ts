import type { TicketStatus } from '../types/index.js';
import { AppError } from '../utils/AppError.js';

/**
 * The ticket status machine, in one place.
 *
 * It used to live as a private const in ticket.controller.ts and was therefore
 * enforced on the HTTP path only — approval.repo.setTicketStatus wrote
 * `UPDATE tickets SET status = ?` directly and could not be checked against it.
 * Any writer must go through assertTransition() so the invariant holds on every
 * path, internal or external.
 *
 * `submitted`         — queued for IT triage (no approval chain).
 * `pending_approval`  — parked on an approver; IT cannot act yet.
 * `waiting`           — approved (or never gated); IT is working it.
 */
export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  submitted: ['pending_approval', 'waiting', 'rejected'],
  pending_approval: ['waiting', 'rejected'],
  waiting: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Throws a 400 unless `from -> to` is a legal edge. Same status is a no-op. */
export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (from === to) return;
  if (!isValidTransition(from, to)) {
    throw AppError.badRequest(`Invalid status transition: ${from} -> ${to}`);
  }
}
