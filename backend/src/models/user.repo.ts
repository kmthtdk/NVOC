import { pool } from '../config/db.js';
import type { UserRow } from './rows.js';

export const userRepo = {
  async findByEmail(email: string): Promise<UserRow | null> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT * FROM users WHERE email = ? AND is_active = 1 LIMIT 1',
      [email],
    );
    return rows[0] ?? null;
  },

  async findById(id: number): Promise<UserRow | null> {
    const [rows] = await pool.query<UserRow[]>(
      'SELECT * FROM users WHERE id = ? LIMIT 1',
      [id],
    );
    return rows[0] ?? null;
  },

  /** Active users, for approver pickers (it_support/admin only via the route). */
  async listActive(): Promise<UserRow[]> {
    const [rows] = await pool.query<UserRow[]>(
      "SELECT * FROM users WHERE is_active = 1 ORDER BY FIELD(role,'admin','it_support','requester'), full_name",
    );
    return rows;
  },
};
