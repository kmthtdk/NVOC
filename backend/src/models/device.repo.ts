import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { pool, withTransaction } from '../config/db.js';
import type { DeviceRow, MacAddressRow } from './rows.js';
import { mapDevice, mapMacAddress } from './mappers.js';
import type { Device, DeviceStatus, DeviceActionType, MacAddress, MacAddressInput, DeviceSpecifications } from '../types/index.js';

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

export interface ReportFilters {
  department?: string;
  deviceType?: string;
  status?: string;
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
  macAddresses?: MacAddressInput[];
  specifications?: DeviceSpecifications;
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
  specifications?: Partial<DeviceSpecifications>;
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
  /** Fetch all MAC addresses for a device. */
  async getMacsByDeviceId(deviceId: number, conn?: PoolConnection): Promise<MacAddress[]> {
    const db = conn ?? pool;
    const [rows] = await db.query<MacAddressRow[]>(
      'SELECT * FROM mac_addresses WHERE device_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [deviceId],
    );
    return rows.map(mapMacAddress);
  },

  /**
   * Add a MAC address to a device.
   * conn is required to support transactional inserts (e.g., during device creation).
   */
  async addMacAddress(
    conn: PoolConnection,
    deviceId: number,
    macType: string,
    macAddress: string,
  ): Promise<MacAddress> {
    const [result] = await conn.execute(
      'INSERT INTO mac_addresses (device_id, mac_type, mac_address) VALUES (?, ?, ?)',
      [deviceId, macType, macAddress],
    );
    const macId = (result as { insertId: number }).insertId;

    // Read back the inserted row to return
    const [rows] = await conn.query<MacAddressRow[]>(
      'SELECT * FROM mac_addresses WHERE id = ? LIMIT 1',
      [macId],
    );
    const row = rows[0];
    if (!row) throw new Error('Failed to read inserted MAC address');
    return mapMacAddress(row);
  },

  /**
   * Update a MAC address record.
   * conn is required for transactional safety.
   * Only device_id stays fixed; mac_type and mac_address can be updated.
   */
  async updateMacAddress(
    conn: PoolConnection,
    macId: number,
    updates: { macType?: string; macAddress?: string },
  ): Promise<MacAddress> {
    const sets: string[] = [];
    const params: (string | number)[] = [];

    if (updates.macType !== undefined) {
      sets.push('mac_type = ?');
      params.push(updates.macType);
    }
    if (updates.macAddress !== undefined) {
      sets.push('mac_address = ?');
      params.push(updates.macAddress);
    }

    if (sets.length > 0) {
      params.push(macId);
      const [result] = await conn.execute(
        `UPDATE mac_addresses SET ${sets.join(', ')} WHERE id = ?`,
        params,
      );
      if ((result as { affectedRows: number }).affectedRows === 0) {
        throw new Error('MAC address not found or not updated');
      }
    }

    // Read back the updated row
    const [rows] = await conn.query<MacAddressRow[]>(
      'SELECT * FROM mac_addresses WHERE id = ? LIMIT 1',
      [macId],
    );
    const row = rows[0];
    if (!row) throw new Error('Failed to read updated MAC address');
    return mapMacAddress(row);
  },

  /**
   * Delete a MAC address.
   * conn is required for transactional safety.
   */
  async removeMacAddress(conn: PoolConnection, macId: number): Promise<void> {
    await conn.execute('DELETE FROM mac_addresses WHERE id = ?', [macId]);
  },

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

  /** Full device with linked tickets and MAC addresses. */
  async getByIdFull(id: number, conn?: PoolConnection): Promise<Device | null> {
    const db = conn ?? pool;
    const [rows] = await db.query<DeviceRow[]>('SELECT * FROM devices WHERE id = ? LIMIT 1', [id]);
    const row = rows[0];
    if (!row) return null;

    // Fetch linked tickets
    const [ticketLinks] = await db.query<RowDataPacket[]>(
      `SELECT ticket_id, action_type FROM ticket_device_links WHERE device_id = ? ORDER BY created_at DESC`,
      [id],
    );

    const linkedTickets = ticketLinks.map((link) => ({
      ticketId: link.ticket_id,
      actionType: link.action_type as 'related' | 'resolved' | 'affected',
    }));

    // Fetch MAC addresses — use conn if available for transactional consistency
    const macAddresses = await this.getMacsByDeviceId(id, conn);

    return mapDevice(row, linkedTickets, macAddresses);
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
   * Optionally insert MAC addresses in the same transaction.
   * conn parameter is optional; if not provided, the function creates its own transaction.
   */
  async create(input: CreateDeviceInput, conn?: PoolConnection): Promise<Device> {
    const year = new Date().getUTCFullYear();

    const createWithConnection = async (connection: PoolConnection): Promise<number> => {
      const code = await nextDeviceCode(connection, year);

      const specsJson = input.specifications?.additionalSpecs
        ? JSON.stringify(input.specifications.additionalSpecs)
        : null;

      const [result] = await connection.execute(
        `INSERT INTO devices
          (code, device_type, model, serial_number, status, assigned_to, department, purchase_date, warranty_expiry, notes, cpu, ram_gb, storage_gb, gpu, psu_watts, specs_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          input.specifications?.cpu ?? null,
          input.specifications?.ramGb ?? null,
          input.specifications?.storageGb ?? null,
          input.specifications?.gpu ?? null,
          input.specifications?.psuWatts ?? null,
          specsJson,
        ],
      );
      const deviceId = (result as { insertId: number }).insertId;

      // Insert MAC addresses if provided
      if (input.macAddresses && input.macAddresses.length > 0) {
        for (const mac of input.macAddresses) {
          await connection.execute(
            'INSERT INTO mac_addresses (device_id, mac_type, mac_address) VALUES (?, ?, ?)',
            [deviceId, mac.macType, mac.macAddress],
          );
        }
      }

      return deviceId;
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

    // Specifications
    if (input.specifications) {
      if (input.specifications.cpu !== undefined) {
        sets.push('cpu = ?');
        params.push(input.specifications.cpu);
      }
      if (input.specifications.ramGb !== undefined) {
        sets.push('ram_gb = ?');
        params.push(input.specifications.ramGb);
      }
      if (input.specifications.storageGb !== undefined) {
        sets.push('storage_gb = ?');
        params.push(input.specifications.storageGb);
      }
      if (input.specifications.gpu !== undefined) {
        sets.push('gpu = ?');
        params.push(input.specifications.gpu);
      }
      if (input.specifications.psuWatts !== undefined) {
        sets.push('psu_watts = ?');
        params.push(input.specifications.psuWatts);
      }
      if (input.specifications.additionalSpecs !== undefined) {
        sets.push('specs_json = ?');
        params.push(input.specifications.additionalSpecs ? JSON.stringify(input.specifications.additionalSpecs) : null);
      }
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
    return withTransaction(async (conn) => {
      // Delete linked tickets first (cascade via FK, but explicit for safety)
      await conn.execute('DELETE FROM ticket_device_links WHERE device_id = ?', [id]);
      // Delete the device
      const [result] = await conn.execute('DELETE FROM devices WHERE id = ?', [id]);
      return (result as { affectedRows: number }).affectedRows > 0;
    });
  },

  /**
   * Link a ticket to a device.
   * conn is required because this is typically called within a larger transaction.
   */
  async createLink(
    conn: PoolConnection,
    ticketId: number,
    deviceId: number,
    actionType: DeviceActionType,
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

  /**
   * Assign device to a user (typically when resolving a hardware request).
   * Logs the assignment to device_history for audit trail.
   */
  async assignToUser(
    deviceId: number,
    _userId: number | null,
    userName: string,
    userEmail: string,
    userDept: string | null,
    ticketId: number | null = null,
    reason: string | null = null,
  ): Promise<Device> {
    return withTransaction(async (conn) => {
      // Update device assignment and status
      await conn.execute(
        'UPDATE devices SET assigned_to = ?, status = ?, department = ?, updated_at = NOW() WHERE id = ?',
        [`${userName} (${userEmail})`, 'Active', userDept || null, deviceId],
      );

      // Log to device_history
      await conn.execute(
        `INSERT INTO device_history (device_id, ticket_id, action_type, assigned_to, department, reason, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [deviceId, ticketId, 'assigned', userName, userDept || null, reason || `Assigned to ${userName}`, 'System'],
      );

      const device = await this.getByIdFull(deviceId, conn);
      if (!device) throw new Error('Device not found after assignment');
      return device;
    });
  },

  /**
   * Checkout a device — update status to In Stock or In Repair, log the action.
   */
  async checkout(
    deviceId: number,
    condition: 'good' | 'damaged' | 'unknown',
    newStatus: DeviceStatus,
    notes: string = '',
    createdBy: string = 'System',
  ): Promise<Device> {
    return withTransaction(async (conn) => {
      // Update device: clear assignment, set new status
      await conn.execute(
        'UPDATE devices SET assigned_to = NULL, status = ?, updated_at = NOW() WHERE id = ?',
        [newStatus, deviceId],
      );

      // Log to device_history
      await conn.execute(
        `INSERT INTO device_history (device_id, action_type, condition_state, notes, created_by)
         VALUES (?, ?, ?, ?, ?)`,
        [deviceId, 'returned', condition, notes || null, createdBy],
      );

      const device = await this.getByIdFull(deviceId, conn);
      if (!device) throw new Error('Device not found after checkout');
      return device;
    });
  },

  /**
   * Get device history report (audit trail of all assignments/returns).
   */
  async getHistoryReport(): Promise<Array<{
    id: number;
    device_code: string;
    device_model: string;
    action_type: string;
    assigned_to: string | null;
    department: string | null;
    reason: string | null;
    created_at: string;
  }>> {
    const [rows] = await pool.query<any[]>(
      `SELECT
        dh.id,
        d.code as device_code,
        d.model as device_model,
        dh.action_type,
        dh.assigned_to,
        dh.department,
        dh.reason,
        DATE_FORMAT(dh.created_at, '%Y-%m-%d %H:%i:%s') as created_at
      FROM device_history dh
      JOIN devices d ON dh.device_id = d.id
      ORDER BY dh.created_at DESC
      LIMIT 500`,
    );
    return rows || [];
  },

  /**
   * Get device inventory summary report.
   */
  async getSummaryReport(): Promise<{
    total: number;
    by_status: Record<string, number>;
    by_type: Record<string, number>;
    by_department: Record<string, number>;
  }> {
    const summary = {
      total: 0,
      by_status: {} as Record<string, number>,
      by_type: {} as Record<string, number>,
      by_department: {} as Record<string, number>,
    };

    const [totalRows] = await pool.query<any[]>(
      'SELECT COUNT(*) as count FROM devices',
    );
    summary.total = totalRows[0]?.count || 0;

    const [statusRows] = await pool.query<any[]>(
      'SELECT status, COUNT(*) as count FROM devices GROUP BY status',
    );
    statusRows.forEach(r => {
      summary.by_status[r.status] = r.count;
    });

    const [typeRows] = await pool.query<any[]>(
      'SELECT device_type, COUNT(*) as count FROM devices GROUP BY device_type',
    );
    typeRows.forEach(r => {
      summary.by_type[r.device_type] = r.count;
    });

    const [deptRows] = await pool.query<any[]>(
      'SELECT COALESCE(department, "Unassigned") as department, COUNT(*) as count FROM devices GROUP BY department',
    );
    deptRows.forEach(r => {
      summary.by_department[r.department] = r.count;
    });

    return summary;
  },

  /**
   * Get device assignments (device → user mapping).
   */
  async getAssignmentsReport(filters: ReportFilters = {}): Promise<Array<{
    device_code: string;
    model: string;
    serial_number: string;
    assigned_to: string | null;
    status: string;
    department: string | null;
  }>> {
    const where: string[] = ['assigned_to IS NOT NULL'];
    const params: (string | null)[] = [];

    if (filters.department) {
      where.push('department = ?');
      params.push(filters.department);
    }
    if (filters.deviceType) {
      where.push('device_type = ?');
      params.push(filters.deviceType);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const [rows] = await pool.query<any[]>(
      `SELECT
        code as device_code,
        model,
        serial_number,
        assigned_to,
        status,
        department
      FROM devices
      ${whereSql}
      ORDER BY assigned_to ASC`,
      params,
    );
    return rows || [];
  },

  /**
   * Get devices nearing warranty expiry.
   */
  async getAgingReport(filters: ReportFilters = {}): Promise<Array<{
    device_code: string;
    model: string;
    assigned_to: string | null;
    warranty_expiry: string | null;
    days_until_expiry: number;
    status: string;
  }>> {
    const where: string[] = [
      'warranty_expiry IS NOT NULL',
      'warranty_expiry <= DATE_ADD(CURDATE(), INTERVAL 90 DAY)',
    ];
    const params: (string | null)[] = [];

    if (filters.department) {
      where.push('department = ?');
      params.push(filters.department);
    }
    if (filters.deviceType) {
      where.push('device_type = ?');
      params.push(filters.deviceType);
    }
    if (filters.status) {
      where.push('status = ?');
      params.push(filters.status);
    }

    const whereSql = `WHERE ${where.join(' AND ')}`;
    const [rows] = await pool.query<any[]>(
      `SELECT
        code as device_code,
        model,
        assigned_to,
        warranty_expiry,
        DATEDIFF(warranty_expiry, CURDATE()) as days_until_expiry,
        status
      FROM devices
      ${whereSql}
      ORDER BY warranty_expiry ASC`,
      params,
    );
    return rows || [];
  },

  /**
   * Get devices by department.
   */
  async getByDepartmentReport(): Promise<Array<{
    department: string | null;
    total: number;
    active: number;
    in_repair: number;
    retired: number;
  }>> {
    const [rows] = await pool.query<any[]>(
      `SELECT
        COALESCE(department, 'Unassigned') as department,
        COUNT(*) as total,
        SUM(IF(status = 'Active', 1, 0)) as active,
        SUM(IF(status = 'In Repair', 1, 0)) as in_repair,
        SUM(IF(status = 'Retired', 1, 0)) as retired
      FROM devices
      GROUP BY department`,
    );
    return rows || [];
  },

  /**
   * Get device availability summary.
   */
  async getAvailabilityReport(): Promise<{
    in_stock: number;
    active: number;
    in_repair: number;
    retired: number;
    lost: number;
  }> {
    const [rows] = await pool.query<any[]>(
      `SELECT
        status,
        COUNT(*) as count
      FROM devices
      GROUP BY status`,
    );

    const report = {
      in_stock: 0,
      active: 0,
      in_repair: 0,
      retired: 0,
      lost: 0,
    };

    rows.forEach((r: any) => {
      const key = r.status.toLowerCase().replace(' ', '_') as keyof typeof report;
      if (key in report) {
        report[key] = r.count;
      }
    });

    return report;
  },

  /**
   * Get all devices linked to a specific ticket.
   */
  async getLinkedByTicketId(ticketId: number): Promise<Array<{ deviceId: number; actionType: DeviceActionType }>> {
    const [rows] = await pool.query<any[]>(
      'SELECT device_id, action_type FROM ticket_device_links WHERE ticket_id = ? ORDER BY created_at DESC',
      [ticketId],
    );
    return rows.map((r) => ({
      deviceId: r.device_id,
      actionType: r.action_type,
    })) || [];
  },

  /**
   * Get daily stock movement (assigned and returned devices by date).
   */
  async getStockMovementReport(): Promise<Array<{
    date: string;
    assigned: number;
    returned: number;
    repaired: number;
  }>> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        DATE(created_at) as date,
        SUM(IF(action_type = 'assigned', 1, 0)) as assigned,
        SUM(IF(action_type = 'returned', 1, 0)) as returned,
        SUM(IF(action_type IN ('repair', 'in_repair'), 1, 0)) as repaired
      FROM device_history
      WHERE DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);
    return rows || [];
  },

  /**
   * Get stock levels by device type and status.
   */
  async getStockByTypeReport(): Promise<Array<{
    device_type: string;
    in_stock: number;
    active: number;
    in_repair: number;
    retired: number;
    total: number;
  }>> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        device_type,
        SUM(IF(status = 'In Stock', 1, 0)) as in_stock,
        SUM(IF(status = 'Active', 1, 0)) as active,
        SUM(IF(status = 'In Repair', 1, 0)) as in_repair,
        SUM(IF(status = 'Retired', 1, 0)) as retired,
        COUNT(*) as total
      FROM devices
      GROUP BY device_type
      ORDER BY total DESC
    `);
    return rows || [];
  },

  /**
   * Get unassigned devices or devices awaiting return.
   */
  async getUnassignedReport(): Promise<Array<{
    id: number;
    code: string;
    device_type: string;
    model: string;
    status: string;
    department: string | null;
  }>> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        id,
        code,
        device_type,
        model,
        status,
        department
      FROM devices
      WHERE assigned_to IS NULL AND status IN ('In Stock', 'In Repair')
      ORDER BY updated_at DESC
    `);
    return rows || [];
  },

  /**
   * Get devices per user (inverse of assignments).
   */
  async getByUserReport(): Promise<Array<{
    user: string;
    department: string | null;
    device_count: number;
    device_types: string;
    statuses: string;
  }>> {
    const [rows] = await pool.query<any[]>(`
      SELECT
        assigned_to as user,
        department,
        COUNT(*) as device_count,
        GROUP_CONCAT(DISTINCT device_type) as device_types,
        GROUP_CONCAT(DISTINCT status) as statuses
      FROM devices
      WHERE assigned_to IS NOT NULL
      GROUP BY assigned_to, department
      ORDER BY device_count DESC
    `);
    return rows || [];
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
