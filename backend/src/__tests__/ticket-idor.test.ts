import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock every DB-touching module so the controller logic runs without a database.
// These tests exercise the Phase 0 security fixes (requester IDOR guards) and the
// ticket status state machine — the pure logic, isolated from MySQL.
vi.mock('../models/ticket.repo.js', () => ({
  ticketRepo: {
    list: vi.fn(),
    getByIdFull: vi.fn(),
    update: vi.fn(),
    exists: vi.fn(),
  },
}));
vi.mock('../models/comment.repo.js', () => ({ commentRepo: { create: vi.fn() } }));
vi.mock('../models/category.repo.js', () => ({ categoryRepo: {} }));
vi.mock('../config/db.js', () => ({ pool: { query: vi.fn() }, withTransaction: vi.fn() }));
vi.mock('../config/logger.js', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));
vi.mock('../models/approval.repo.js', () => ({
  approvalRepo: { isApprover: vi.fn().mockResolvedValue(false) },
  mapApproval: vi.fn(),
}));
vi.mock('../services/approval.service.js', () => ({
  approvalService: {
    getChain: vi.fn().mockResolvedValue([]),
    isPending: vi.fn().mockResolvedValue(false),
    startApproval: vi.fn().mockResolvedValue(undefined),
  },
}));

import { ticketController } from '../controllers/ticket.controller.js';
import { ticketRepo } from '../models/ticket.repo.js';
import { commentRepo } from '../models/comment.repo.js';
import { approvalRepo } from '../models/approval.repo.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
function mockRes() {
  const res: any = {};
  res.json = vi.fn().mockReturnValue(res);
  res.status = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

const OWNER_TICKET = { id: 5, requesterEmail: 'owner@x.com', status: 'submitted' };

beforeEach(() => vi.clearAllMocks());

describe('IDOR — ticket list scoping (F-01)', () => {
  it('forces requesterEmail to the JWT email for a requester', async () => {
    (ticketRepo.list as any).mockResolvedValue({ data: [], total: 0 });
    const req: any = { query: {}, user: { role: 'requester', email: 'a@x.com', name: 'A' } };
    await ticketController.list(req, mockRes());
    expect(ticketRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ requesterEmail: 'a@x.com' }),
    );
  });

  it('does NOT scope for it_support (full visibility)', async () => {
    (ticketRepo.list as any).mockResolvedValue({ data: [], total: 0 });
    const req: any = { query: {}, user: { role: 'it_support', email: 'it@x.com', name: 'IT' } };
    await ticketController.list(req, mockRes());
    const arg = (ticketRepo.list as any).mock.calls[0][0];
    expect(arg.requesterEmail).toBeUndefined();
  });

  it('ignores a client-supplied requesterEmail and pins it to the JWT (no spoofing)', async () => {
    (ticketRepo.list as any).mockResolvedValue({ data: [], total: 0 });
    const req: any = {
      query: { requesterEmail: 'victim@x.com' },
      user: { role: 'requester', email: 'attacker@x.com', name: 'X' },
    };
    await ticketController.list(req, mockRes());
    expect(ticketRepo.list).toHaveBeenCalledWith(
      expect.objectContaining({ requesterEmail: 'attacker@x.com' }),
    );
  });
});

describe('IDOR — ticket detail (F-01)', () => {
  it('404s when a requester reads another user\'s ticket', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    const req: any = { params: { id: '5' }, user: { role: 'requester', email: 'other@x.com', name: 'O' } };
    await expect(ticketController.get(req, mockRes())).rejects.toMatchObject({ statusCode: 404 });
  });

  it('lets the owner read their own ticket', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    const res = mockRes();
    const req: any = { params: { id: '5' }, user: { role: 'requester', email: 'owner@x.com', name: 'O' } };
    await ticketController.get(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ticket: OWNER_TICKET }));
  });

  it('lets it_support read any ticket', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    const res = mockRes();
    const req: any = { params: { id: '5' }, user: { role: 'it_support', email: 'it@x.com', name: 'IT' } };
    await ticketController.get(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ticket: OWNER_TICKET }));
  });

  it('lets a requester who is an approver-in-chain read the ticket (approval visibility)', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    (approvalRepo.isApprover as any).mockResolvedValueOnce(true);
    const res = mockRes();
    const req: any = { params: { id: '5' }, user: { role: 'requester', email: 'leader@x.com', name: 'L' } };
    await ticketController.get(req, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ ticket: OWNER_TICKET }));
  });
});

describe('IDOR — comment add (F-03, write guard)', () => {
  it('404s and does not create when a requester comments on another user\'s ticket', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    const req: any = {
      params: { id: '5' },
      body: { content: 'hi' },
      user: { role: 'requester', email: 'other@x.com', name: 'O' },
    };
    await expect(ticketController.addComment(req, mockRes())).rejects.toMatchObject({ statusCode: 404 });
    expect(commentRepo.create).not.toHaveBeenCalled();
  });

  it('lets the owner comment on their own ticket', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue(OWNER_TICKET);
    (commentRepo.create as any).mockResolvedValue({ id: 1, content: 'hi' });
    const res = mockRes();
    const req: any = {
      params: { id: '5' },
      body: { content: 'hi' },
      user: { role: 'requester', email: 'owner@x.com', name: 'O' },
    };
    await ticketController.addComment(req, res);
    expect(commentRepo.create).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('ticket status state machine', () => {
  it('rejects an invalid transition (resolved -> submitted) with 400', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue({ ...OWNER_TICKET, status: 'resolved' });
    const req: any = { params: { id: '5' }, body: { status: 'submitted' }, user: { role: 'it_support', name: 'IT' } };
    await expect(ticketController.update(req, mockRes())).rejects.toMatchObject({ statusCode: 400 });
  });

  it('allows a valid transition (submitted -> waiting)', async () => {
    (ticketRepo.getByIdFull as any).mockResolvedValue({ ...OWNER_TICKET, status: 'submitted' });
    (ticketRepo.update as any).mockResolvedValue({ ...OWNER_TICKET, status: 'waiting' });
    const res = mockRes();
    const req: any = { params: { id: '5' }, body: { status: 'waiting' }, user: { role: 'it_support', name: 'IT' } };
    await ticketController.update(req, res);
    expect(res.json).toHaveBeenCalled();
  });
});
