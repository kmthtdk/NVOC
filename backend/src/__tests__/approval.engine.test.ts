import { describe, it, expect } from 'vitest';
import {
  chainState,
  activeStep,
  canDecide,
  applyDecision,
  insertAdHoc,
  type ApprovalStep,
} from '../services/approval.engine.js';

const step = (order: number, status: ApprovalStep['status'], uid: number | null = null): ApprovalStep => ({
  stepOrder: order,
  status,
  approverUserId: uid,
});

describe('chainState', () => {
  it('empty chain is approved (nothing to approve)', () => {
    expect(chainState([])).toBe('approved');
  });
  it('all approved -> approved', () => {
    expect(chainState([step(1, 'approved'), step(2, 'approved')])).toBe('approved');
  });
  it('approved + skipped -> approved', () => {
    expect(chainState([step(1, 'approved'), step(2, 'skipped')])).toBe('approved');
  });
  it('any rejected -> rejected (even with pending left)', () => {
    expect(chainState([step(1, 'rejected'), step(2, 'pending')])).toBe('rejected');
  });
  it('some pending -> in_progress', () => {
    expect(chainState([step(1, 'approved'), step(2, 'pending')])).toBe('in_progress');
  });
});

describe('activeStep / canDecide', () => {
  it('returns the first pending step by order', () => {
    const steps = [step(2, 'pending'), step(1, 'approved'), step(3, 'pending')];
    expect(activeStep(steps)?.stepOrder).toBe(2);
  });
  it('null when nothing pending', () => {
    expect(activeStep([step(1, 'approved')])).toBeNull();
  });
  it('canDecide only for the active step', () => {
    const steps = [step(1, 'approved'), step(2, 'pending'), step(3, 'pending')];
    expect(canDecide(steps, 2)).toBe(true);
    expect(canDecide(steps, 3)).toBe(false); // not yet active
    expect(canDecide(steps, 1)).toBe(false); // already decided
  });
});

describe('applyDecision', () => {
  const chain = () => [step(1, 'pending', 10), step(2, 'pending', 20)];

  it('approving the first of two -> in_progress, no ticket action', () => {
    const r = applyDecision(chain(), 1, 'approve');
    expect(r.chainState).toBe('in_progress');
    expect(r.ticketAction).toBe('none');
    expect(r.steps.find((s) => s.stepOrder === 1)?.status).toBe('approved');
  });

  it('approving the final step -> approved, advance ticket', () => {
    const afterFirst = applyDecision(chain(), 1, 'approve').steps;
    const r = applyDecision(afterFirst, 2, 'approve');
    expect(r.chainState).toBe('approved');
    expect(r.ticketAction).toBe('advance');
  });

  it('rejecting any step -> rejected, reject ticket', () => {
    const r = applyDecision(chain(), 1, 'reject');
    expect(r.chainState).toBe('rejected');
    expect(r.ticketAction).toBe('reject');
  });

  it('throws when deciding a non-active step (out of order)', () => {
    expect(() => applyDecision(chain(), 2, 'approve')).toThrow();
  });
});

describe('insertAdHoc', () => {
  it('inserts a pending signer at position, shifting later steps down', () => {
    const steps = [step(1, 'approved', 10), step(2, 'pending', 20)];
    const out = insertAdHoc(steps, 2, 99);
    // old step2 becomes step3; new ad-hoc is step2 pending with approver 99
    expect(out.map((s) => s.stepOrder)).toEqual([1, 2, 3]);
    const inserted = out.find((s) => s.stepOrder === 2)!;
    expect(inserted.approverUserId).toBe(99);
    expect(inserted.status).toBe('pending');
    expect(out.find((s) => s.stepOrder === 3)?.approverUserId).toBe(20);
  });

  it('the inserted step becomes the next active step', () => {
    const steps = [step(1, 'approved', 10), step(2, 'pending', 20)];
    const out = insertAdHoc(steps, 2, 99);
    expect(activeStep(out)?.approverUserId).toBe(99);
  });
});
