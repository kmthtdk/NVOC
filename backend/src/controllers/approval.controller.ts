import type { Request, Response } from 'express';
import { z } from 'zod';
import { approvalService } from '../services/approval.service.js';
import { AppError } from '../utils/AppError.js';

export const decideSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  note: z.string().max(2000).nullable().optional().default(null),
});

export const assignApproverSchema = z.object({
  userId: z.number().int().positive(),
});

export const addSignerSchema = z.object({
  afterStep: z.number().int().min(0),
  userId: z.number().int().positive(),
});

function parseTicketId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid ticket id');
  return id;
}
function parseStep(req: Request): number {
  const step = Number(req.params.step);
  if (!Number.isInteger(step) || step <= 0) throw AppError.badRequest('Invalid step');
  return step;
}

export const approvalController = {
  /** GET /tickets/approvals/inbox — tickets awaiting the caller's approval. */
  async inbox(req: Request, res: Response): Promise<void> {
    if (!req.user) throw AppError.unauthorized();
    const pending = await approvalService.pendingForUser(Number(req.user.sub));
    res.json({ pending });
  },

  /** POST /tickets/:id/approvals/:step/decide — approve/reject the active step. */
  async decide(req: Request, res: Response): Promise<void> {
    if (!req.user) throw AppError.unauthorized();
    const body = req.body as z.infer<typeof decideSchema>;
    const result = await approvalService.decide(
      parseTicketId(req),
      parseStep(req),
      body.decision,
      req.user,
      body.note ?? null,
    );
    res.json(result);
  },

  /** POST /tickets/:id/approvals/:step/assign — assign an approver (it_support/admin). */
  async assign(req: Request, res: Response): Promise<void> {
    const body = req.body as z.infer<typeof assignApproverSchema>;
    const chain = await approvalService.assignApprover(parseTicketId(req), parseStep(req), body.userId);
    res.json({ chain });
  },

  /** POST /tickets/:id/approvals/add-signer — insert an ad-hoc signer (open mode). */
  async addSigner(req: Request, res: Response): Promise<void> {
    const body = req.body as z.infer<typeof addSignerSchema>;
    const chain = await approvalService.addSigner(parseTicketId(req), body.afterStep, body.userId);
    res.json({ chain });
  },
};
