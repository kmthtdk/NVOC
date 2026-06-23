import type { Request, Response } from 'express';
import { z } from 'zod';
import { ticketRepo } from '../models/ticket.repo.js';
import { categoryRepo } from '../models/category.repo.js';
import { commentRepo } from '../models/comment.repo.js';
import { AppError } from '../utils/AppError.js';

const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
const STATUS = ['submitted', 'processing', 'pending_user', 'resolved', 'rejected'] as const;
const COMMENT_ROLE = ['requester', 'it_support'] as const;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// ---- Validation schemas ----
export const createTicketSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(1),
  requesterName: z.string().min(1).max(150),
  requesterEmail: z.string().email(),
  requesterDept: z.string().min(1).max(150),
  category: z.string().min(1).max(50),
  subcategory: z.string().min(1).max(60),
  type: z.string().max(60).nullish(),
  priority: z.enum(PRIORITY).default('medium'),
  assignedTo: z.string().max(150).default('Unassigned'),
  periodFrom: dateString.nullish(),
  periodTo: dateString.nullish(),
  details: z.record(z.string(), z.unknown()).default({}),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUS).optional(),
    priority: z.enum(PRIORITY).optional(),
    assignedTo: z.string().max(150).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => v.status !== undefined || v.priority !== undefined || v.assignedTo !== undefined, {
    message: 'At least one of status, priority, or assignedTo is required',
  });

export const listQuerySchema = z.object({
  status: z.enum(STATUS).optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(PRIORITY).optional(),
  assignedTo: z.string().max(150).optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const createCommentSchema = z.object({
  author: z.string().min(1).max(150),
  role: z.enum(COMMENT_ROLE),
  content: z.string().min(1).max(5000),
});

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw AppError.badRequest('Invalid ticket id');
  return id;
}

export const ticketController = {
  /** GET /tickets — filtered + paginated list. */
  async list(req: Request, res: Response): Promise<void> {
    const q = listQuerySchema.parse(req.query);
    const { data, total } = await ticketRepo.list(q);
    res.json({ data, page: q.page, pageSize: q.pageSize, total });
  },

  /** GET /tickets/:id — full ticket with comments/history/attachments. */
  async get(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    const ticket = await ticketRepo.getByIdFull(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    res.json({ ticket });
  },

  /** POST /tickets — create. Enforces the type period rule server-side. */
  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as z.infer<typeof createTicketSchema>;

    // If a type is supplied and it requires a period, both dates are mandatory.
    if (body.type) {
      const type = await categoryRepo.findType(body.type);
      if (!type) throw AppError.badRequest(`Unknown request type: ${body.type}`);
      if (type.period_required === 'Apply' && (!body.periodFrom || !body.periodTo)) {
        throw AppError.badRequest(
          'periodFrom and periodTo are required for this request type',
        );
      }
    }

    // Prefer the authenticated identity as requester when present.
    const requesterId = req.user ? Number(req.user.sub) : null;

    const ticket = await ticketRepo.create({
      title: body.title,
      description: body.description,
      requesterId: Number.isInteger(requesterId) ? requesterId : null,
      requesterName: body.requesterName,
      requesterEmail: body.requesterEmail,
      requesterDept: body.requesterDept,
      category: body.category,
      subcategory: body.subcategory,
      type: body.type ?? null,
      priority: body.priority,
      assignedTo: body.assignedTo,
      periodFrom: body.periodFrom ?? null,
      periodTo: body.periodTo ?? null,
      details: body.details,
    });

    res.status(201).json({ ticket });
  },

  /** PUT /tickets/:id — status/priority/assignee changes (it_support/admin). */
  async update(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    if (!(await ticketRepo.exists(id))) throw AppError.notFound('Ticket not found');

    const body = req.body as z.infer<typeof updateTicketSchema>;
    const actor = req.user?.name ?? 'IT Support';

    const ticket = await ticketRepo.update(
      id,
      { status: body.status, priority: body.priority, assignedTo: body.assignedTo },
      actor,
      body.notes,
    );
    res.json({ ticket });
  },

  /** DELETE /tickets/:id — admin only; cascades comments/history/attachments. */
  async remove(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    const deleted = await ticketRepo.delete(id);
    if (!deleted) throw AppError.notFound('Ticket not found');
    res.status(204).send();
  },

  /** POST /tickets/:id/comments — add a comment to the thread. */
  async addComment(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    if (!(await ticketRepo.exists(id))) throw AppError.notFound('Ticket not found');

    const body = req.body as z.infer<typeof createCommentSchema>;
    const comment = await commentRepo.create({
      ticketId: id,
      author: body.author,
      role: body.role,
      content: body.content,
    });
    res.status(201).json({ comment });
  },
};
