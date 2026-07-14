import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import type { TicketRow } from './rows.js';
import { mapTicket } from './mappers.js';
import { commentRepo, historyRepo } from './comment.repo.js';
import { attachmentRepo } from './attachment.repo.js';
import { deviceRepo } from './device.repo.js';
import { approvalRepo } from './approval.repo.js';
import { likeContains } from '../utils/search.js';
import type {
  Ticket,
  TicketPriority,
  TicketStatus,
  TicketDetails,
  DeviceSpecifications,
} from '../types/index.js';

export interface TicketListFilters {
  status?: TicketStatus;
  category?: string;
  priority?: TicketPriority;
  assignedTo?: string;
  requesterEmail?: string;
  q?: string;
  page: number;
  pageSize: number;
  sort: 'newest' | 'oldest';
}

export interface CreateTicketInput {
  title: string;
  description: string;
  requesterId: number | null;
  requesterName: string;
  requesterEmail: string;
  requesterDept: string;
  category: string;
  subcategory: string;
  type: string | null;
  priority: TicketPriority;
  assignedTo: string;
  periodFrom: string | null;
  periodTo: string | null;
  details: TicketDetails;
  // Device-related fields for hardware requests
  deviceAction?: 'new' | 'repair' | 'return' | 'replace';
  deviceType?: string;
  deviceSerialNumber?: string;
  deviceModel?: string;
  specifications?: DeviceSpecifications;
}

export interface UpdateTicketInput {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedTo?: string;
}

/**
 * Allocate the next <PREFIX>-YYYY-NNNN code inside a transaction. The counter is
 * per (prefix, year), so each main category numbers independently (HW-2026-0001,
 * SE-2026-0001, ...). SELECT ... FOR UPDATE serializes concurrent POSTs.
 */
async function nextTicketCode(
  conn: PoolConnection,
  prefix: string,
  year: number,
): Promise<string> {
  await conn.execute(
    // Touch last_seq (not a no-op like `prefix = prefix`) so the row gets an
    // exclusive lock immediately — avoids a shared->exclusive upgrade deadlock
    // when two requests create the first ticket of a (prefix, year) concurrently.
    'INSERT INTO ticket_sequence (prefix, year, last_seq) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE last_seq = last_seq',
    [prefix, year],
  );
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT last_seq FROM ticket_sequence WHERE prefix = ? AND year = ? FOR UPDATE',
    [prefix, year],
  );
  const current = Number(rows[0]?.last_seq ?? 0);
  const next = current + 1;
  await conn.execute(
    'UPDATE ticket_sequence SET last_seq = ? WHERE prefix = ? AND year = ?',
    [next, prefix, year],
  );
  return `${prefix}-${year}-${String(next).padStart(4, '0')}`;
}

/** Resolve a category's ticket-code prefix; falls back to 'REQ' if unset. */
async function categoryPrefix(conn: PoolConnection, categoryId: string): Promise<string> {
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT code_prefix FROM categories WHERE id = ? LIMIT 1',
    [categoryId],
  );
  const p = rows[0]?.code_prefix as string | null | undefined;
  return p && p.trim() ? p.trim() : 'REQ';
}

export const ticketRepo = {
  /** Paginated, filtered list. Summary rows only (no nested comments/history). */
  async list(filters: TicketListFilters): Promise<{ data: Ticket[]; total: number }> {
    const where: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.category) {
      where.push('category_id = ?');
      params.push(filters.category);
    }
    if (filters.priority) {
      where.push('priority = ?');
      params.push(filters.priority);
    }
    if (filters.assignedTo) {
      where.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }
    if (filters.requesterEmail) {
      where.push('LOWER(requester_email) = LOWER(?)');
      params.push(filters.requesterEmail);
    }
    if (filters.q && filters.q.trim()) {
      // FULLTEXT over (title, description, requester_name), OR the code.
      // `code` is not in the fulltext index and would not tokenise usefully if it
      // were ("GR-2026-0001" is not a word), so pasting a ticket reference — the
      // most common thing anyone types into a search box — found nothing at all.
      where.push(
        `(MATCH(title, description, requester_name) AGAINST (? IN NATURAL LANGUAGE MODE)
          OR code LIKE ? ESCAPE '\\\\')`,
      );
      params.push(filters.q.trim(), likeContains(filters.q));
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = filters.sort === 'oldest' ? 'ASC' : 'DESC';
    const offset = (filters.page - 1) * filters.pageSize;

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM tickets ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<TicketRow[]>(
      `SELECT * FROM tickets ${whereSql} ORDER BY created_at ${orderSql}, id ${orderSql} LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    );

    // List view returns ticket fields with empty nested arrays (detail endpoint hydrates).
    const data = rows.map((r) => mapTicket(r, [], []));
    return { data, total };
  },

  /**
   * Newly-arrived tickets, gated or not. A `status = 'submitted'` filter would
   * hide every ticket routed into the approval chain, so new requests would
   * silently vanish from the admin's "recent" panel the moment approval is on.
   */
  async listRecentIncoming(limit: number): Promise<Ticket[]> {
    const [rows] = await pool.query<TicketRow[]>(
      `SELECT * FROM tickets
        WHERE status IN ('submitted', 'pending_approval')
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      [limit],
    );
    return rows.map((r) => mapTicket(r, [], []));
  },

  /**
   * Submitted tickets nobody has picked up yet. `assigned_to` is free text and
   * NOT NULL DEFAULT 'Unassigned', so an IS NULL branch would be dead — the
   * unpicked states are the literal 'Unassigned' and the empty string.
   * An IN(...) on the two lets the (status, assigned_to) composite serve this.
   */
  async listUnassignedPending(limit: number): Promise<Ticket[]> {
    const [rows] = await pool.query<TicketRow[]>(
      `SELECT * FROM tickets
        WHERE status = 'submitted'
          AND assigned_to IN ('Unassigned', '')
        ORDER BY created_at DESC, id DESC
        LIMIT ?`,
      [limit],
    );
    return rows.map((r) => mapTicket(r, [], []));
  },

  /** Full ticket with nested comments, history, and attachments. */
  async getByIdFull(id: number): Promise<Ticket | null> {
    const [rows] = await pool.query<TicketRow[]>('SELECT * FROM tickets WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return null;

    const [comments, history, attachments, linkedDevices] = await Promise.all([
      commentRepo.listByTicket(id),
      historyRepo.listByTicket(id),
      attachmentRepo.listByTicket(id),
      deviceRepo.getLinkedByTicketId(id),
    ]);
    return mapTicket(row, comments, history, attachments, linkedDevices);
  },

  async exists(id: number): Promise<boolean> {
    const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 FROM tickets WHERE id = ? LIMIT 1', [id]);
    return rows.length > 0;
  },

  /**
   * Create a ticket + its first history row atomically, generating the code
   * inside the same transaction.
   */
  async create(input: CreateTicketInput): Promise<Ticket> {
    const year = new Date().getUTCFullYear();

    const newId = await withTransaction(async (conn) => {
      const prefix = await categoryPrefix(conn, input.category);
      const code = await nextTicketCode(conn, prefix, year);

      const [result] = await conn.execute(
        `INSERT INTO tickets
          (code, title, description, requester_id, requester_name, requester_email, requester_dept,
           category_id, subcategory_id, type_id, priority, status, assigned_to, period_from, period_to, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)`,
        [
          code,
          input.title,
          input.description,
          input.requesterId,
          input.requesterName,
          input.requesterEmail,
          input.requesterDept,
          input.category,
          input.subcategory,
          input.type,
          input.priority,
          input.assignedTo,
          input.periodFrom,
          input.periodTo,
          JSON.stringify(input.details ?? {}),
        ],
      );
      const ticketId = (result as { insertId: number }).insertId;

      // Seed the first audit row.
      await historyRepo.append(conn, {
        ticketId,
        status: 'submitted',
        statusLabel: 'VOC Submitted',
        updatedBy: input.requesterName,
        notes: 'Awaiting IT triage.',
      });

      // Handle device creation/linking for hardware requests
      if (input.category === 'hardware_request' && input.deviceAction) {
        if (input.deviceAction === 'new') {
          // Create a new device for this hardware request
          const newDevice = await deviceRepo.create(
            {
              deviceType: input.deviceType || input.subcategory || 'IT equipment',
              model: input.deviceModel || 'Unspecified',
              serialNumber: `TEMP-${ticketId}-${Date.now()}`,
              status: 'In Stock',
              department: input.requesterDept || null,
              purchaseDate: null,
              warrantyExpiry: null,
              notes: `Created from VOC ${code}`,
              specifications: input.specifications,
            },
            conn
          );
          // Link the ticket to the created device (will throw on failure)
          await deviceRepo.createLink(conn, ticketId, newDevice.id, 'new');
          await historyRepo.append(conn, {
            ticketId,
            status: 'submitted',
            statusLabel: 'Device Created',
            updatedBy: 'System',
            notes: `Device ${newDevice.code} created for this request.`,
          });
        } else if (input.deviceAction === 'repair' || input.deviceAction === 'return' || input.deviceAction === 'replace') {
          // Link to existing device
          if (input.deviceSerialNumber) {
            const existingDevice = await deviceRepo.findBySerial(input.deviceSerialNumber);
            if (!existingDevice) {
              throw new Error(`Device with serial number ${input.deviceSerialNumber} not found`);
            }
            // Link device (will throw on failure)
            await deviceRepo.createLink(conn, ticketId, existingDevice.id, input.deviceAction);
            // Update device status for repair/return
            if (input.deviceAction === 'repair' || input.deviceAction === 'return') {
              await deviceRepo.setStatus(
                conn,
                existingDevice.id,
                'In Repair',
                ticketId,
                `Device sent for ${input.deviceAction} via ticket`,
              );
            }
            await historyRepo.append(conn, {
              ticketId,
              status: 'submitted',
              statusLabel: 'Device Linked',
              updatedBy: 'System',
              notes: `Device ${existingDevice.code} linked to this request.`,
            });
          }
        }
      }

      // Materialize the approval chain in THIS transaction so a failure rolls the
      // whole ticket back (never leave a ticket with 0 approval rows that would
      // silently bypass the approval gate).
      const isGated = await approvalRepo.instantiateForNewTicket(
        ticketId,
        input.requesterDept,
        conn,
      );

      // A gated ticket is parked on an approver, not queued for IT. Saying so in
      // `status` is what lets IT filter it out of their queue, lets the requester
      // see who is blocking, and keeps approval latency out of IT's SLA numbers.
      if (isGated) {
        await conn.execute('UPDATE tickets SET status = ? WHERE id = ?', [
          'pending_approval',
          ticketId,
        ]);
        await historyRepo.append(conn, {
          ticketId,
          status: 'pending_approval',
          statusLabel: 'Awaiting Approval',
          updatedBy: 'System',
          notes: 'Routed to the approval chain before IT fulfillment.',
        });
      }

      return ticketId;
    });

    const created = await this.getByIdFull(newId);
    if (!created) throw new Error('Ticket creation failed to read back');
    return created;
  },

  /**
   * Update status/priority/assignee. Status changes append a history row
   * (and assignee-only changes too) within one transaction.
   */
  async update(
    id: number,
    input: UpdateTicketInput,
    actor: string,
    notes?: string,
  ): Promise<Ticket | null> {
    await withTransaction(async (conn) => {
      const sets: string[] = [];
      const params: (string | number | null)[] = [];

      if (input.status !== undefined) {
        sets.push('status = ?');
        params.push(input.status);
      }
      if (input.priority !== undefined) {
        sets.push('priority = ?');
        params.push(input.priority);
      }
      if (input.assignedTo !== undefined) {
        sets.push('assigned_to = ?');
        params.push(input.assignedTo);
      }

      if (sets.length > 0) {
        params.push(id);
        await conn.execute(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`, params);
      }

      // Append audit entry when status changes (preferred) or assignment changes.
      if (input.status !== undefined) {
        await historyRepo.append(conn, {
          ticketId: id,
          status: input.status,
          statusLabel: STATUS_LABELS[input.status],
          updatedBy: actor,
          notes: notes ?? `Status updated to ${input.status}.`,
        });
      } else if (input.assignedTo !== undefined) {
        // Keep a record of reassignment without changing status.
        const [rows] = await conn.query<RowDataPacket[]>('SELECT status FROM tickets WHERE id = ?', [id]);
        const status = (rows[0]?.status as TicketStatus) ?? 'submitted';
        await historyRepo.append(conn, {
          ticketId: id,
          status,
          statusLabel: 'Reassigned',
          updatedBy: actor,
          notes: notes ?? `Assigned to ${input.assignedTo}.`,
        });
      } else if (input.priority !== undefined || (notes && notes.trim())) {
        // Priority-only change or a standalone note — still record it (previously
        // the note was silently discarded with no audit entry).
        const [rows] = await conn.query<RowDataPacket[]>('SELECT status FROM tickets WHERE id = ?', [id]);
        const status = (rows[0]?.status as TicketStatus) ?? 'submitted';
        await historyRepo.append(conn, {
          ticketId: id,
          status,
          statusLabel: input.priority !== undefined ? 'Priority updated' : 'Note added',
          updatedBy: actor,
          notes: notes ?? `Priority set to ${input.priority}.`,
        });
      }
    });

    return this.getByIdFull(id);
  },

  async delete(id: number): Promise<boolean> {
    const [result] = await pool.execute('DELETE FROM tickets WHERE id = ?', [id]);
    return (result as { affectedRows: number }).affectedRows > 0;
  },
};

const STATUS_LABELS: Record<TicketStatus, string> = {
  submitted: 'VOC Submitted',
  pending_approval: 'Awaiting Approval',
  waiting: 'Waiting for Review',
  resolved: 'Issue Resolved',
  rejected: 'Request Rejected',
};
