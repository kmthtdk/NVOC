import { describe, it, expect } from 'vitest';
import { assertTransition, isValidTransition, VALID_TRANSITIONS } from '../services/ticket-status.js';
import type { TicketStatus } from '../types/index.js';

const ALL: TicketStatus[] = ['submitted', 'pending_approval', 'waiting', 'resolved', 'rejected'];

describe('ticket status machine', () => {
  it('routes a gated ticket through the approval state before IT sees it', () => {
    expect(isValidTransition('submitted', 'pending_approval')).toBe(true);
    expect(isValidTransition('pending_approval', 'waiting')).toBe(true);
    expect(isValidTransition('waiting', 'resolved')).toBe(true);
  });

  it('lets an ungated ticket skip approval entirely', () => {
    expect(isValidTransition('submitted', 'waiting')).toBe(true);
  });

  it('refuses to resolve a ticket that is still awaiting approval', () => {
    // The whole point of the state: IT cannot fulfil what nobody has signed off.
    expect(isValidTransition('pending_approval', 'resolved')).toBe(false);
    expect(() => assertTransition('pending_approval', 'resolved')).toThrow(/Invalid status transition/);
  });

  it('allows rejection from either open state', () => {
    expect(isValidTransition('pending_approval', 'rejected')).toBe(true);
    expect(isValidTransition('submitted', 'rejected')).toBe(true);
  });

  it('never reopens a closed ticket', () => {
    for (const to of ALL) {
      if (to === 'resolved') continue;
      expect(isValidTransition('resolved', to)).toBe(false);
    }
    for (const to of ALL) {
      if (to === 'rejected') continue;
      expect(isValidTransition('rejected', to)).toBe(false);
    }
  });

  it('cannot send an in-flight ticket backwards to pending_approval', () => {
    // Guards the approval workflow's own write path: re-gating a ticket IT is
    // already working would silently pull it out of their queue.
    expect(isValidTransition('waiting', 'pending_approval')).toBe(false);
    expect(isValidTransition('resolved', 'pending_approval')).toBe(false);
  });

  it('treats a no-op transition as allowed', () => {
    expect(() => assertTransition('waiting', 'waiting')).not.toThrow();
  });

  it('covers every status in the union — a new status must be declared here', () => {
    expect(Object.keys(VALID_TRANSITIONS).sort()).toEqual([...ALL].sort());
  });
});
