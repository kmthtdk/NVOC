import type { Request, Response } from 'express';
import { z } from 'zod';
import { ticketRepo } from '../models/ticket.repo.js';
import { categoryRepo } from '../models/category.repo.js';
import { commentRepo } from '../models/comment.repo.js';
import { AppError } from '../utils/AppError.js';
import { pool } from '../config/db.js';

const PRIORITY = ['low', 'medium', 'high', 'urgent'] as const;
const STATUS = ['submitted', 'processing', 'pending_user', 'resolved', 'rejected'] as const;
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

// Valid ticket status transitions state machine
const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ['processing', 'rejected'],
  processing: ['pending_user', 'resolved', 'rejected'],
  pending_user: ['processing', 'resolved', 'rejected'],
  resolved: [],
  rejected: [],
};

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
  content: z.string().min(1).max(5000),
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
      // Device fields for hardware requests
      deviceAction: body.deviceAction,
      deviceType: body.deviceType,
      deviceSerialNumber: body.deviceSerialNumber,
      deviceModel: body.deviceModel,
      specifications: body.specifications,
    });

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
    if (!(await ticketRepo.exists(id))) throw AppError.notFound('Ticket not found');

    if (!req.user) throw AppError.unauthorized('Authentication required');

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

  /** GET /stats/summary — Dashboard summary statistics for current month */
  async getStatsSummary(_req: Request, res: Response): Promise<void> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get status counts for current month using SQL GROUP BY
    const [statusRows] = await pool.query<any[]>(`
      SELECT
        status,
        COUNT(*) as count
      FROM tickets
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY status
    `, [year, month]);

    const statusCounts: Record<string, number> = {
      submitted: 0,
      processing: 0,
      pending_user: 0,
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
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY category_id
    `, [year, month]);

    const categoryCounts: Record<string, number> = {};
    categoryRows.forEach((row: any) => {
      categoryCounts[row.category_id] = row.count;
    });

    // Get priority counts
    const [priorityRows] = await pool.query<any[]>(`
      SELECT priority, COUNT(*) as count
      FROM tickets
      WHERE YEAR(created_at) = ? AND MONTH(created_at) = ?
      GROUP BY priority
    `, [year, month]);

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
    const pendingTickets = statusCounts.submitted + statusCounts.processing + statusCounts.pending_user;

    res.json({
      period: 'current_month',
      summary: {
        total: totalTickets,
        submitted: statusCounts.submitted,
        processing: statusCounts.processing,
        pending_user: statusCounts.pending_user,
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
    const { data: allTickets } = await ticketRepo.list({
      page: 1,
      pageSize: 100,
      sort: 'newest',
    });

    const submitted = allTickets
      .filter(t => t.status === 'submitted')
      .slice(0, 5);

    const resolved = allTickets
      .filter(t => t.status === 'resolved')
      .slice(0, 5);

    const pending = allTickets
      .filter(t => ['submitted', 'processing', 'pending_user'].includes(t.status))
      .filter(t => !t.assignedTo || t.assignedTo === 'Unassigned')
      .slice(0, 5);

    res.json({
      recent_submitted: submitted,
      recent_resolved: resolved,
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
