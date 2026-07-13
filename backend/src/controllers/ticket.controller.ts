import type { Request, Response } from 'express';
import { z } from 'zod';
import { ticketRepo } from '../models/ticket.repo.js';
import { categoryRepo } from '../models/category.repo.js';
import { commentRepo } from '../models/comment.repo.js';
import { approvalRepo } from '../models/approval.repo.js';
import { approvalService } from '../services/approval.service.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../config/db.js';

const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
const STATUS = ['submitted', 'waiting', 'resolved', 'rejected'] as const;

/** Rows per bucket returned by GET /stats/recent. */
const RECENT_LIMIT = 5;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// Valid ticket status transitions state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ['waiting', 'rejected'],
  waiting: ['resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

// ---- Validation schemas ----
export const createTicketSchema = z.object({
  // .trim() before .min() so whitespace-only values (e.g. "   ") are rejected —
  // .min() alone counts spaces. The frontend already blocks these; this closes
  // the direct-API gap.
  title: z.string().trim().min(3).max(255),
  description: z.string().trim().min(1),
  requesterName: z.string().trim().min(1).max(150),
  requesterEmail: z.string().trim().email(),
  requesterDept: z.string().trim().min(1).max(150),
  category: z.string().min(1).max(50),
  subcategory: z.string().min(1).max(60),
  type: z.string().max(60).nullish(),
  priority: z.enum(PRIORITY).default('medium'),
  assignedTo: z.string().max(150).default('Unassigned'),
  periodFrom: dateString.nullish(),
  periodTo: dateString.nullish(),
  details: z.record(z.string(), z.unknown()).default({}),
  // Device fields for hardware requests
  deviceAction: z.enum(['new', 'repair', 'return', 'replace']).optional(),
  deviceType: z.string().max(50).optional(),
  deviceSerialNumber: z.string().max(100).optional(),
  deviceModel: z.string().max(150).optional(),
  specifications: z.object({
    cpu: z.string().max(255).nullable().optional(),
    ramGb: z.number().min(1).max(1024).nullable().optional(),
    storageGb: z.number().min(1).max(10000).nullable().optional(),
    gpu: z.string().max(255).nullable().optional(),
    psuWatts: z.number().min(0).max(2000).nullable().optional(),
  }).optional(),
});

export const updateTicketSchema = z
  .object({
    status: z.enum(STATUS).optional(),
    priority: z.enum(PRIORITY).optional(),
    assignedTo: z.string().max(150).optional(),
    notes: z.string().max(2000).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.priority !== undefined ||
      v.assignedTo !== undefined ||
      v.notes !== undefined,
    { message: 'At least one of status, priority, assignedTo, or notes is required' },
  );

export const listQuerySchema = z.object({
  status: z.enum(STATUS).optional(),
  category: z.string().max(50).optional(),
  priority: z.enum(PRIORITY).optional(),
  assignedTo: z.string().max(150).optional(),
  requesterEmail: z.string().email().optional(),
  q: z.string().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  sort: z.enum(['newest', 'oldest']).default('newest'),
});

export const createCommentSchema = z.object({
  content: z.string().trim().min(1).max(5000),
});

export const linkDeviceSchema = z.object({
  deviceId: z.number().int().positive(),
  actionType: z.enum(['new', 'related', 'resolved', 'affected']).default('related'),
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
    // Requesters may only see their OWN tickets. Force the requesterEmail filter
    // to the authenticated email (which they cannot spoof — it comes from the JWT),
    // overriding any client-supplied value. it_support/admin keep full visibility.
    const scoped =
      req.user?.role === 'requester' ? { ...q, requesterEmail: req.user.email } : q;
    const { data, total } = await ticketRepo.list(scoped);
    res.json({ data, page: scoped.page, pageSize: scoped.pageSize, total });
  },

  /** GET /tickets/:id — full ticket with comments/history/attachments. */
  async get(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    const ticket = await ticketRepo.getByIdFull(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    // Read authorization: a requester may read a ticket they filed OR one where
    // they are an approver in its chain (their leader duty). Others 404 — 404 not
    // 403 so ticket existence isn't leaked. it_support/admin always pass.
    if (req.user?.role === 'requester') {
      const isOwner = ticket.requesterEmail.toLowerCase() === req.user.email.toLowerCase();
      const isApprover = isOwner ? false : await approvalRepo.isApprover(id, Number(req.user.sub));
      if (!isOwner && !isApprover) {
        throw AppError.notFound('Ticket not found');
      }
    }
    const approvals = await approvalService.getChain(id);
    res.json({ ticket, approvals });
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
      // Device fields for hardware requests
      deviceAction: body.deviceAction,
      deviceType: body.deviceType,
      deviceSerialNumber: body.deviceSerialNumber,
      deviceModel: body.deviceModel,
      specifications: body.specifications,
    });

    // Approval chain is materialized inside ticketRepo.create's transaction
    // (atomic with the ticket), so there's nothing to do here.
    res.status(201).json({ ticket });
  },

  /** PUT /tickets/:id — status/priority/assignee changes (it_support/admin). */
  async update(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);

    // Fetch current ticket to validate status transition
    const current = await ticketRepo.getByIdFull(id);
    if (!current) throw AppError.notFound('Ticket not found');

    const body = req.body as z.infer<typeof updateTicketSchema>;

    // Validate status transition if status is being changed
    if (body.status && body.status !== current.status) {
      // Approval gate: while the chain is in progress, status is driven by the
      // approval flow (auto-advances to 'waiting' when approved). Block manual
      // changes so IT can't resolve a request before it's approved.
      if (await approvalService.isPending(id)) {
        throw AppError.badRequest('Ticket is awaiting approval and cannot change status yet');
      }
      const validNextStates = VALID_TRANSITIONS[current.status];
      if (!validNextStates || !validNextStates.includes(body.status)) {
        throw AppError.badRequest(
          `Cannot transition from '${current.status}' to '${body.status}'`
        );
      }
    }

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
    if (!req.user) throw AppError.unauthorized('Authentication required');

    const ticket = await ticketRepo.getByIdFull(id);
    if (!ticket) throw AppError.notFound('Ticket not found');
    // A requester may only comment on a ticket they filed (write-IDOR guard,
    // mirrors the list/detail read guard). 404 (not 403) avoids leaking existence.
    if (
      req.user.role === 'requester' &&
      ticket.requesterEmail.toLowerCase() !== req.user.email.toLowerCase()
    ) {
      throw AppError.notFound('Ticket not found');
    }

    const body = req.body as z.infer<typeof createCommentSchema>;
    const comment = await commentRepo.create({
      ticketId: id,
      author: req.user.name,
      role: req.user.role === 'requester' ? 'requester' : 'it_support',
      content: body.content,
    });
    res.status(201).json({ comment });
  },

  /** POST /tickets/:id/link-device — link a device to a ticket. */
  async linkDevice(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    if (!(await ticketRepo.exists(id))) throw AppError.notFound('Ticket not found');

    const body = req.body as z.infer<typeof linkDeviceSchema>;

    // Insert into ticket_device_links table
    await pool.query(
      `INSERT INTO ticket_device_links (ticket_id, device_id, action_type)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE action_type = VALUES(action_type)`,
      [id, body.deviceId, body.actionType],
    );

    res.status(201).json({ success: true, ticketId: id, deviceId: body.deviceId });
  },

  /**
   * GET /stats/summary?period=current_month|all — dashboard summary counts,
   * aggregated in SQL.
   *
   * `period` defaults to current_month (the original behaviour). The admin
   * dashboard asks for `all`: it used to derive these breakdowns client-side
   * from a 100-row page, which silently under-reported once the table grew past
   * 100 tickets.
   */
  async getStatsSummary(req: Request, res: Response): Promise<void> {
    const period = req.query.period === 'all' ? 'all' : 'current_month';

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // One period predicate reused by all three aggregates.
    const periodSql = period === 'all' ? '' : 'WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?';
    const periodParams = period === 'all' ? [] : [year, month];

    const [statusRows] = await pool.query<any[]>(`
      SELECT
        status,
        COUNT(*) as count
      FROM tickets
      ${periodSql}
      GROUP BY status
    `, periodParams);

    const statusCounts: Record<string, number> = {
      submitted: 0,
      waiting: 0,
      resolved: 0,
      rejected: 0,
    };

    statusRows.forEach((row: any) => {
      if (row.status in statusCounts) {
        statusCounts[row.status] = row.count;
      }
    });

    // Get category counts
    const [categoryRows] = await pool.query<any[]>(`
      SELECT category_id, COUNT(*) as count
      FROM tickets
      ${periodSql}
      GROUP BY category_id
    `, periodParams);

    const categoryCounts: Record<string, number> = {};
    categoryRows.forEach((row: any) => {
      categoryCounts[row.category_id] = row.count;
    });

    // Get priority counts
    const [priorityRows] = await pool.query<any[]>(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      ${periodSql}
      GROUP BY priority
    `, periodParams);

    const priorityCounts = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    priorityRows.forEach((row: any) => {
      if (row.priority in priorityCounts) {
        priorityCounts[row.priority as keyof typeof priorityCounts] = row.count;
      }
    });

    // Calculate metrics
    const totalTickets = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    const resolvedTickets = statusCounts.resolved;
    const resolutionRate = totalTickets > 0 ? Math.round((resolvedTickets / totalTickets) * 100) : 0;
    const pendingTickets = statusCounts.submitted + statusCounts.waiting;

    res.json({
      period,
      summary: {
        total: totalTickets,
        submitted: statusCounts.submitted,
        waiting: statusCounts.waiting,
        resolved: statusCounts.resolved,
        rejected: statusCounts.rejected,
        pending: pendingTickets,
        resolutionRate,
      },
      categories: categoryCounts,
      priorities: priorityCounts,
      lastUpdated: new Date().toISOString(),
    });
  },

  /** GET /stats/recent — Recent ticket activity */
  async getStatsRecent(_req: Request, res: Response): Promise<void> {
    // Three targeted queries, not one 100-row fetch filtered in JS. The old
    // approach sliced the 100 newest tickets by status, so recent_resolved came
    // back empty whenever none of the 100 newest happened to be resolved — even
    // with plenty of older resolved tickets in the table.
    const [submitted, resolved, pending] = await Promise.all([
      ticketRepo.list({ page: 1, pageSize: RECENT_LIMIT, sort: 'newest', status: 'submitted' }),
      ticketRepo.list({ page: 1, pageSize: RECENT_LIMIT, sort: 'newest', status: 'resolved' }),
      ticketRepo.listUnassignedPending(RECENT_LIMIT),
    ]);

    res.json({
      recent_submitted: submitted.data,
      recent_resolved: resolved.data,
      unassigned_pending: pending,
    });
  },

  /** GET /tickets/reports/pending-hardware — open hardware requests. */
  async getPendingHardwareReport(_req: Request, res: Response): Promise<void> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        id,
        code,
        title,
        created_at,
        priority,
        requester_name,
        assigned_to,
        status,
        category_id,
        subcategory_id
      FROM tickets
      WHERE category_id = 'hardware_request' AND status NOT IN ('resolved', 'rejected')
      ORDER BY created_at ASC
      LIMIT 500
    `);
    res.json({ pendingRequests: rows || [] });
  },

  /** GET /tickets/reports/fulfillment-time — avg time from submit to resolve. */
  async getFulfillmentTimeReport(_req: Request, res: Response): Promise<void> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        category_id,
        COUNT(*) as total_resolved,
        ROUND(AVG(TIMESTAMPDIFF(HOUR, created_at, updated_at))) as avg_hours,
        MIN(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as min_hours,
        MAX(TIMESTAMPDIFF(HOUR, created_at, updated_at)) as max_hours
      FROM tickets
      WHERE status = 'resolved' AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY category_id
      ORDER BY avg_hours DESC
    `);
    res.json({ fulfillmentStats: rows || [] });
  },

  /** GET /tickets/reports/age-buckets — tickets bucketed by age. */
  async getAgeBucketsReport(_req: Request, res: Response): Promise<void> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        CASE
          WHEN DATEDIFF(CURDATE(), DATE(created_at)) <= 3 THEN '0-3 days'
          WHEN DATEDIFF(CURDATE(), DATE(created_at)) <= 7 THEN '4-7 days'
          WHEN DATEDIFF(CURDATE(), DATE(created_at)) <= 14 THEN '8-14 days'
          WHEN DATEDIFF(CURDATE(), DATE(created_at)) <= 30 THEN '15-30 days'
          ELSE '30+ days'
        END as age_bucket,
        status,
        COUNT(*) as count
      FROM tickets
      WHERE status NOT IN ('resolved', 'rejected')
      GROUP BY age_bucket, status
      ORDER BY FIELD(age_bucket, '0-3 days', '4-7 days', '8-14 days', '15-30 days', '30+ days')
    `);

    // Format response as bucketed data
    const buckets: Record<string, any> = {
      '0-3 days': {},
      '4-7 days': {},
      '8-14 days': {},
      '15-30 days': {},
      '30+ days': {},
    };

    rows.forEach((row: any) => {
      if (buckets[row.age_bucket]) {
        buckets[row.age_bucket][row.status] = row.count;
      }
    });

    res.json({ ageBuckets: buckets });
  },

  /** GET /tickets/reports/category-trend — monthly category volume. */
  async getCategoryTrendReport(_req: Request, res: Response): Promise<void> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        category_id,
        COUNT(*) as count
      FROM tickets
      WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
      GROUP BY month, category_id
      ORDER BY month DESC, count DESC
    `);
    res.json({ categoryTrend: rows || [] });
  },
};
