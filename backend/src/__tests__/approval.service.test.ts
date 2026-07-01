import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB layer: withTransaction just runs the callback with a fake conn;
// the repo is fully stubbed so the service's decision logic runs without MySQL.
vi.mock('../config/db.js', () => ({
  pool: { query: vi.fn(), execute: vi.fn() },
  withTransaction: (fn: (conn: unknown) => unknown) => fn({}),
}));
vi.mock('../models/approval.repo.js', () => ({
  approvalRepo: {
    getChain: vi.fn(),
    getTicketMeta: vi.fn(),
    decideStep: vi.fn(),
    setTicketStatus: vi.fn(),
    enqueueNotification: vi.fn(),
    insertSigner: vi.fn(),
    isApprovalEnabled: vi.fn(),
    instantiate: vi.fn(),
  },
  mapApproval: (r: unknown) => r,
}));

import { approvalService } from '../services/approval.service.js';
import { approvalRepo } from '../models/approval.repo.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const row = (stepOrder: number, status: string, approverUserId: number | null) => ({
  step_order: stepOrder,
  status,
  approver_user_id: approverUserId,
});
const meta = (requesterId: number | null, status = 'submitted') => ({
  requester_id: requesterId,
  requester_email: 'owner@x.com',
  requester_dept: 'R&D',
  status,
});
const user = (sub: string, role: string) => ({ sub, role, email: `${sub}@x.com`, name: sub }) as any;

beforeEach(() => vi.clearAllMocks());

describe('approvalService.decide — authorization', () => {
  it('blocks self-approval anchored to requester_id (not email)', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', 5)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(5)); // requester_id === approver id
    await expect(approvalService.decide(1, 1, 'approve', user('5', 'requester'), null)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(approvalRepo.decideStep).not.toHaveBeenCalled();
  });

  it('blocks a non-assigned, non-privileged user', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', 5)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    await expect(approvalService.decide(1, 1, 'approve', user('7', 'requester'), null)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('allows it_support only on an UNASSIGNED step', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', null)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    (approvalRepo.decideStep as any).mockResolvedValue(1);
    await approvalService.decide(1, 1, 'approve', user('2', 'it_support'), null);
    expect(approvalRepo.decideStep).toHaveBeenCalled();
  });

  it('blocks it_support on a step assigned to someone else (named approver binding)', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', 5)]); // assigned to user 5
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    await expect(approvalService.decide(1, 1, 'approve', user('2', 'it_support'), null)).rejects.toMatchObject({
      statusCode: 403,
    });
  });
});

describe('approvalService.decide — ticket actions', () => {
  it('final approval advances the ticket to waiting + enqueues completion', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'approved', 1), row(2, 'pending', 2)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    (approvalRepo.decideStep as any).mockResolvedValue(1);
    await approvalService.decide(1, 2, 'approve', user('2', 'it_support'), null);
    expect(approvalRepo.setTicketStatus).toHaveBeenCalledWith(1, 'waiting', expect.any(String), '2', expect.anything());
    const events = (approvalRepo.enqueueNotification as any).mock.calls.map((c: any) => c[0].event);
    expect(events).toContain('approval_completed');
  });

  it('any rejection sets the ticket to rejected', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', 2)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    (approvalRepo.decideStep as any).mockResolvedValue(1);
    await approvalService.decide(1, 1, 'reject', user('2', 'it_support'), null);
    expect(approvalRepo.setTicketStatus).toHaveBeenCalledWith(1, 'rejected', expect.any(String), '2', expect.anything());
  });

  it('aborts with 409 when the step was already decided (race)', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'pending', 2)]);
    (approvalRepo.getTicketMeta as any).mockResolvedValue(meta(99));
    (approvalRepo.decideStep as any).mockResolvedValue(0); // lost the race
    await expect(approvalService.decide(1, 1, 'approve', user('2', 'it_support'), null)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

describe('approvalService.addSigner', () => {
  it('refuses to insert into an already-completed chain', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'approved', 1), row(2, 'approved', 2)]);
    await expect(approvalService.addSigner(1, 2, 7)).rejects.toMatchObject({ statusCode: 409 });
    expect(approvalRepo.insertSigner).not.toHaveBeenCalled();
  });

  it('inserts into a live chain', async () => {
    (approvalRepo.getChain as any).mockResolvedValue([row(1, 'approved', 1), row(2, 'pending', 2)]);
    (approvalRepo.insertSigner as any).mockResolvedValue(3);
    await approvalService.addSigner(1, 2, 7);
    expect(approvalRepo.insertSigner).toHaveBeenCalled();
  });
});
