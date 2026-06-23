import type { PoolConnection } from 'mysql2/promise';
import { pool } from '../config/db.js';
import type { CommentRow } from './rows.js';
import { mapComment } from './mappers.js';
import type { TicketComment, CommentRole } from '../types/index.js';

export const commentRepo = {
  async listByTicket(ticketId: number): Promise<TicketComment[]> {
    const [rows] = await pool.query<CommentRow[]>(
      'SELECT * FROM comments WHERE ticket_id = ? ORDER BY created_at ASC, id ASC',
      [ticketId],
    );
    return rows.map(mapComment);
  },

  async create(input: {
    ticketId: number;
    author: string;
    role: CommentRole;
    content: string;
  }): Promise<TicketComment> {
    const [result] = await pool.execute(
      'INSERT INTO comments (ticket_id, author, role, content) VALUES (?, ?, ?, ?)',
      [input.ticketId, input.author, input.role, input.content],
    );
    const insertId = (result as { insertId: number }).insertId;
    const [rows] = await pool.query<CommentRow[]>('SELECT * FROM comments WHERE id = ?', [insertId]);
    return mapComment(rows[0]);
  },
};

/** History helpers (kept here for cohesion with comment writes during status changes). */
export const historyRepo = {
  async listByTicket(ticketId: number) {
    const { mapHistory } = await import('./mappers.js');
    const [rows] = await pool.query(
      'SELECT * FROM ticket_history WHERE ticket_id = ? ORDER BY created_at ASC, id ASC',
      [ticketId],
    );
    return (rows as import('./rows.js').HistoryRow[]).map(mapHistory);
  },

  /** Append a history row; accepts an optional connection so it can join a transaction. */
  async append(
    conn: PoolConnection | typeof pool,
    input: { ticketId: number; status: string; statusLabel: string; updatedBy: string; notes?: string },
  ): Promise<void> {
    await conn.execute(
      'INSERT INTO ticket_history (ticket_id, status, status_label, updated_by, notes) VALUES (?, ?, ?, ?, ?)',
      [input.ticketId, input.status, input.statusLabel, input.updatedBy, input.notes ?? null],
    );
  },
};
