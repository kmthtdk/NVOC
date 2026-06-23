import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import type { DeviceRow } from './rows.js';
import { mapDevice } from './mappers.js';
import type { Device, DeviceStatus } from '../types/index.js';

export interface DeviceListFilters {
  deviceType?: string;
  status?: DeviceStatus;
  assignedTo?: string;
  department?: string;
  q?: string;
  page: number;
  pageSize: number;
  sort: 'newest' | 'oldest';
}

export interface CreateDeviceInput {
  deviceType: string;
  model: string;
  serialNumber: string;
  status: DeviceStatus;
  assignedTo: string | null;
  department: string | null;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
}

export interface UpdateDeviceInput {
  deviceType?: string;
  model?: string;
  serialNumber?: string;
  status?: DeviceStatus;
  assignedTo?: string | null;
  department?: string | null;
  purchaseDate?: string | null;
  warrantyExpiry?: string | null;
  notes?: string | null;
}

export interface TicketDeviceLinkInput {
  ticketId: number;
  deviceId: number;
  actionType: 'related' | 'resolved' | 'affected';
}

/**
 * Allocate the next ITA-YYYY-NNNN code inside a transaction.
 * SELECT ... FOR UPDATE on the per-year counter row serializes concurrent POSTs,
 * preventing duplicate codes under load.
 */
async function nextDeviceCode(conn: PoolConnection, year: number): Promise<string> {
  await conn.execute(
    'INSERT INTO device_sequence (year, last_seq) VALUES (?, 0) ON DUPLICATE KEY UPDATE year = year',
    [year],
  );
  const [rows] = await conn.query<RowDataPacket[]>(
    'SELECT last_seq FROM device_sequence WHERE year = ? FOR UPDATE',
    [year],
  );
  const current = Number(rows[0]?.last_seq ?? 0);
  const next = current + 1;
  await conn.execute('UPDATE device_sequence SET last_seq = ? WHERE year = ?', [next, year]);
  return `ITA-${year}-${String(next).padStart(4, '0')}`;
}

export const deviceRepo = {
  /** Paginated, filtered list. Summary rows only. */
  async list(filters: DeviceListFilters): Promise<{ data: Device[]; total: number }> {
    const where: string[] = [];
    const params: (string | number | null)[] = [];

    if (filters.deviceType) {
      where.push('device_type = ?');
      params.push(filters.deviceType);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }
    if (filters.assignedTo) {
      where.push('assigned_to = ?');
      params.push(filters.assignedTo);
    }
    if (filters.department) {
      where.push('department = ?');
      params.push(filters.department);
    }
    if (filters.q && filters.q.trim()) {
      // Search across code, model, serial number
      where.push('MATCH(code, model, serial_number) AGAINST (? IN NATURAL LANGUAGE MODE)');
      params.push(filters.q.trim());
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const orderSql = filters.sort === 'oldest' ? 'ASC' : 'DESC';
    const offset = (filters.page - 1) * filters.pageSize;

    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM devices ${whereSql}`,
      params,
    );
    const total = Number(countRows[0]?.total ?? 0);

    const [rows] = await pool.query<DeviceRow[]>(
      `SELECT * FROM devices ${whereSql} ORDER BY created_at ${orderSql}, id ${orderSql} LIMIT ? OFFSET ?`,
      [...params, filters.pageSize, offset],
    );

    const data = rows.map((r) => mapDevice(r, []));
    return { data, total };
  },

  /** Full device with linked tickets. */
  async getByIdFull(id: number): Promise<Device | null> {
    const [rows] = await pool.query<DeviceRow[]>('SELECT * FROM devices WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return null;

    // Fetch linked tickets
    const [ticketLinks] = await pool.query<RowDataPacket[]>(
      `SELECT ticket_id, action_type FROM ticket_device_links WHERE device_id = ? ORDER BY created_at DESC`,
      [id],
    );

    const linkedTickets = ticketLinks.map((link) => ({
      ticketId: link.ticket_id,
      actionType: link.action_type as 'related' | 'resolved' | 'affected',
    }));

    return mapDevice(row, linkedTickets);
  },

  /** Quick lookup by serial number (may return null). */
  async findBySerial(serialNumber: string): Promise<Device | null> {
    const [rows] = await pool.query<DeviceRow[]>(
      'SELECT * FROM devices WHERE serial_number = ? LIMIT 1',
      [serialNumber.trim()],
    );
    const row = rows[0];
    if (!row) return null;

    // Fetch linked tickets
    const [ticketLinks] = await pool.query<RowDataPacket[]>(
      `SELECT ticket_id, action_type FROM ticket_device_links WHERE device_id = ? ORDER BY created_at DESC`,
      [row.id],
    );

    const linkedTickets = ticketLinks.map((link) => ({
      ticketId: link.ticket_id,
      actionType: link.action_type as 'related' | 'resolved' | 'affected',
    }));

    return mapDevice(row, linkedTickets);
  },

  /**
   * Create a device atomically, generating the ITA code inside the transaction.
   * conn parameter is optional; if not provided, the function creates its own transaction.
   */
  async create(input: CreateDeviceInput, conn?: PoolConnection): Promise<Device> {
    const year = new Date().getUTCFullYear();

    const createWithConnection = async (connection: PoolConnection): Promise<number> => {
      const code = await nextDeviceCode(connection, year);

      const [result] = await connection.execute(
        `INSERT INTO devices
          (code, device_type, model, serial_number, status, assigned_to, department, purchase_date, warranty_expiry, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          code,
          input.deviceType,
          input.model,
          input.serialNumber,
          input.status,
          input.assignedTo,
          input.department,
          input.purchaseDate,
          input.warrantyExpiry,
          input.notes,
        ],
      );
      return (result as { insertId: number }).insertId;
    };

    const newId = conn
      ? await createWithConnection(conn)
      : await withTransaction(createWithConnection);

    const created = await this.getByIdFull(newId);
    if (!created) throw new Error('Device creation failed to read back');
    return created;
  },

  /** Update device fields. */
  async update(id: number, input: UpdateDeviceInput): Promise<Device | null> {
    const sets: string[] = [];
    const params: (string | number | null)[] = [];

    if (input.deviceType !== undefined) {
      sets.push('device_type = ?');
      params.push(input.deviceType);
    }
    if (input.model !== undefined) {
      sets.push('model = ?');
      params.push(input.model);
    }
    if (input.serialNumber !== undefined) {
      sets.push('serial_number = ?');
      params.push(input.serialNumber);
    }
    if (input.status !== undefined) {
      sets.push('status = ?');
      params.push(input.status);
    }
    if (input.assignedTo !== undefined) {
      sets.push('assigned_to = ?');
      params.push(input.assignedTo);
    }
    if (input.department !== undefined) {
      sets.push('department = ?');
      params.push(input.department);
    }
    if (input.purchaseDate !== undefined) {
      sets.push('purchase_date = ?');
      params.push(input.purchaseDate);
    }
    if (input.warrantyExpiry !== undefined) {
      sets.push('warranty_expiry = ?');
      params.push(input.warrantyExpiry);
    }
    if (input.notes !== undefined) {
      sets.push('notes = ?');
      params.push(input.notes);
    }

    if (sets.length > 0) {
      params.push(id);
      const [result] = await pool.execute(
        `UPDATE devices SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
      if ((result as { affectedRows: number }).affectedRows === 0) return null;
    }

    return this.getByIdFull(id);
  },

  /** Delete device. */
  async delete(id: number): Promise<boolean> {
    // Delete linked tickets first (cascade via FK, but explicit for safety)
    await pool.execute('DELETE FROM ticket_device_links WHERE device_id = ?', [id]);
    // Delete the device
    const [result] = await pool.execute('DELETE FROM devices WHERE id = ?', [id]);
    return (result as { affectedRows: number }).affectedRows > 0;
  },

  /**
   * Link a ticket to a device.
   * conn is required because this is typically called within a larger transaction.
   */
  async createLink(
    conn: PoolConnection,
    ticketId: number,
    deviceId: number,
    actionType: 'related' | 'resolved' | 'affected',
  ): Promise<void> {
    await conn.execute(
      'INSERT INTO ticket_device_links (ticket_id, device_id, action_type) VALUES (?, ?, ?)',
      [ticketId, deviceId, actionType],
    );
  },

  /**
   * Set device status (used within transactions by other repos).
   * conn is required for transactional consistency.
   */
  async setStatus(conn: PoolConnection, deviceId: number, status: DeviceStatus): Promise<void> {
    await conn.execute('UPDATE devices SET status = ? WHERE id = ?', [status, deviceId]);
  },
};

/**
 * Export for use within ticketRepo.create() or other transactional flows.
 * Wraps the device creation logic in the caller's transaction context.
 */
export async function createDeviceInTransaction(
  conn: PoolConnection,
  input: CreateDeviceInput,
): Promise<Device> {
  return deviceRepo.create(input, conn);
}
