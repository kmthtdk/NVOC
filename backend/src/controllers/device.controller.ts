import type { Request, Response } from 'express';
import { z } from 'zod';
import { deviceRepo, type ReportFilters } from '../models/device.repo.js';
import { AppError } from '../utils/AppError.js';
import { withTransaction } from '../config/db.js';
import type { DeviceStatus } from '../types/index.js';

// ----------------------------------------------------------------------------
// Validation schemas — mirror the `devices` table / Device domain type.
// status uses the VOC Title-Case enum: Active | In Repair | Retired | Lost.
// MAC address format: 00:00:00:00:00:00 (12 hex pairs separated by colons)
// ----------------------------------------------------------------------------
const DEVICE_STATUSES = ['Active', 'In Repair', 'Retired', 'Lost', 'In Stock'] as const;
const MAC_ADDRESS_TYPES = ['Ethernet', 'WiFi', 'Bluetooth', 'Other'] as const;
const MAC_ADDRESS_REGEX = /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/;

const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable()
  .optional();

const macAddressSchema = z.object({
  macType: z.enum(MAC_ADDRESS_TYPES),
  macAddress: z
    .string()
    .regex(MAC_ADDRESS_REGEX, 'MAC address must be in format 00:00:00:00:00:00'),
});

const specificationSchema = z.object({
  cpu: z.string().max(255).nullable().optional(),
  ramGb: z.number().int().min(1).max(1024).nullable().optional(),
  storageGb: z.number().int().min(1).max(10000).nullable().optional(),
  gpu: z.string().max(255).nullable().optional(),
  psuWatts: z.number().int().min(0).max(2000).nullable().optional(),
  additionalSpecs: z.record(z.string()).nullable().optional(),
});

export const createDeviceSchema = z.object({
  deviceType: z.string().min(1, 'Device type is required').max(50),
  model: z.string().min(1, 'Model is required').max(150),
  serialNumber: z.string().min(1, 'Serial number is required').max(100),
  status: z.enum(DEVICE_STATUSES).default('In Stock'),
  assignedTo: z.string().max(150).nullable().optional().default(null),
  department: z.string().max(100).nullable().optional().default(null),
  purchaseDate: nullableDate.default(null),
  warrantyExpiry: nullableDate.default(null),
  // Purchase / procurement
  supplier: z.string().max(150).nullable().optional().default(null),
  purchaseCost: z.number().nonnegative().max(9999999999.99).nullable().optional().default(null),
  currency: z.string().max(3).nullable().optional().default(null),
  poNumber: z.string().max(80).nullable().optional().default(null),
  invoiceNo: z.string().max(80).nullable().optional().default(null),
  notes: z.string().max(2000).nullable().optional().default(null),
  macAddresses: z.array(macAddressSchema).optional(),
  specifications: specificationSchema.optional(),
});

export const updateDeviceSchema = createDeviceSchema.partial();

export const updateMacSchema = z.object({
  macType: z.enum(MAC_ADDRESS_TYPES).optional(),
  macAddress: z
    .string()
    .regex(MAC_ADDRESS_REGEX, 'MAC address must be in format 00:00:00:00:00:00')
    .optional(),
});

export const checkoutDeviceSchema = z.object({
  condition: z.enum(['good', 'damaged', 'unknown']).default('good'),
  notes: z.string().max(500).optional().default(''),
  actionType: z.enum(['return', 'replace']).default('return'),
});

export const assignDeviceSchema = z.object({
  userId: z.number().int().positive().optional().nullable(),
  userName: z.string().min(1).max(150),
  userEmail: z.string().email(),
  userDept: z.string().max(100).optional().nullable(),
  ticketId: z.string().max(50).optional().nullable(),
  reason: z.string().max(500).optional(),
});

// Export macAddressSchema for use in route validation
export { macAddressSchema };

export type CreateDeviceBody = z.infer<typeof createDeviceSchema>;
export type UpdateDeviceBody = z.infer<typeof updateDeviceSchema>;
export type UpdateMacBody = z.infer<typeof updateMacSchema>;

function parsePositiveInt(value: string | undefined, fieldName: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw AppError.badRequest(`Invalid ${fieldName}`);
  }
  return n;
}

/**
 * Device API handlers. Plain object literal to match the project convention
 * (see category.controller.ts / ticket.controller.ts). All handlers are async
 * and wrapped with asyncHandler in the router, so they can throw AppError.
 */
export const deviceController = {
  /** GET /devices — paginated, filtered list. Any authenticated user. */
  async list(req: Request, res: Response): Promise<void> {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const sort = req.query.sort === 'oldest' ? 'oldest' : 'newest';

    const statusParam = typeof req.query.status === 'string' ? req.query.status : undefined;
    if (statusParam && !DEVICE_STATUSES.includes(statusParam as DeviceStatus)) {
      throw AppError.badRequest(`Invalid status filter: ${statusParam}`);
    }

    const result = await deviceRepo.list({
      deviceType: typeof req.query.deviceType === 'string' ? req.query.deviceType : undefined,
      status: statusParam as DeviceStatus | undefined,
      assignedTo: typeof req.query.assignedTo === 'string' ? req.query.assignedTo : undefined,
      department: typeof req.query.department === 'string' ? req.query.department : undefined,
      q: typeof req.query.q === 'string' ? req.query.q : undefined,
      page,
      pageSize,
      sort,
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / pageSize),
      },
    });
  },

  /** GET /devices/search?serial= — quick lookup by serial number. */
  async search(req: Request, res: Response): Promise<void> {
    const serial = typeof req.query.serial === 'string' ? req.query.serial.trim() : '';
    if (!serial) {
      throw AppError.badRequest('Query parameter "serial" is required');
    }
    const device = await deviceRepo.findBySerial(serial);
    if (!device) {
      throw AppError.notFound(`No device found with serial number "${serial}"`);
    }
    res.json({ data: device });
  },

  /** GET /devices/:id — full device with linked tickets. */
  async get(req: Request, res: Response): Promise<void> {
    const id = parsePositiveInt(req.params.id, 'device id');
    const device = await deviceRepo.getByIdFull(id);
    if (!device) {
      throw AppError.notFound('Device not found');
    }
    res.json({ data: device });
  },

  /** POST /devices — create. it_support / admin only. */
  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateDeviceBody;

    // Guard against duplicate serial numbers with a friendly 409.
    const existing = await deviceRepo.findBySerial(body.serialNumber);
    if (existing) {
      throw AppError.conflict(
        `A device with serial number "${body.serialNumber}" already exists`,
      );
    }

    const device = await deviceRepo.create({
      deviceType: body.deviceType,
      model: body.model,
      serialNumber: body.serialNumber,
      status: body.status,
      assignedTo: body.assignedTo ?? null,
      department: body.department ?? null,
      purchaseDate: body.purchaseDate ?? null,
      warrantyExpiry: body.warrantyExpiry ?? null,
      supplier: body.supplier ?? null,
      purchaseCost: body.purchaseCost ?? null,
      currency: body.currency ?? null,
      poNumber: body.poNumber ?? null,
      invoiceNo: body.invoiceNo ?? null,
      notes: body.notes ?? null,
      macAddresses: body.macAddresses,
      specifications: body.specifications,
    });

    res.status(201).json({ data: device });
  },

  /** PUT /devices/:id — update. it_support / admin only. */
  async update(req: Request, res: Response): Promise<void> {
    const id = parsePositiveInt(req.params.id, 'device id');
    const body = req.body as UpdateDeviceBody;

    // If the serial number is changing, ensure it stays unique.
    if (body.serialNumber !== undefined) {
      const clash = await deviceRepo.findBySerial(body.serialNumber);
      if (clash && clash.id !== id) {
        throw AppError.conflict(
          `A device with serial number "${body.serialNumber}" already exists`,
        );
      }
    }

    const device = await deviceRepo.update(id, body);
    if (!device) {
      throw AppError.notFound('Device not found');
    }
    res.json({ data: device });
  },

  /** DELETE /devices/:id — admin only. */
  async remove(req: Request, res: Response): Promise<void> {
    const id = parsePositiveInt(req.params.id, 'device id');
    const ok = await deviceRepo.delete(id);
    if (!ok) {
      throw AppError.notFound('Device not found');
    }
    res.status(204).send();
  },

  /** POST /devices/:id/mac — create a new MAC address for a device. it_support / admin only. */
  async createMac(req: Request, res: Response): Promise<void> {
    const deviceId = parsePositiveInt(req.params.id, 'device id');
    const body = req.body as z.infer<typeof macAddressSchema>;

    // Verify the device exists
    const device = await deviceRepo.getByIdFull(deviceId);
    if (!device) {
      throw AppError.notFound('Device not found');
    }

    // Create within a transaction
    const created = await withTransaction(async (conn) => {
      return deviceRepo.addMacAddress(conn, deviceId, body.macType, body.macAddress);
    });

    res.status(201).json({ data: created });
  },

  /** PUT /devices/:id/mac/:macId — update a specific MAC address. it_support / admin only. */
  async updateMac(req: Request, res: Response): Promise<void> {
    const deviceId = parsePositiveInt(req.params.id, 'device id');
    const macId = parsePositiveInt(req.params.macId, 'MAC id');
    const body = req.body as UpdateMacBody;

    // Verify the device exists
    const device = await deviceRepo.getByIdFull(deviceId);
    if (!device) {
      throw AppError.notFound('Device not found');
    }

    // Verify the MAC address belongs to this device
    const macs = await deviceRepo.getMacsByDeviceId(deviceId);
    const mac = macs.find((m) => m.id === macId);
    if (!mac) {
      throw AppError.notFound('MAC address not found on this device');
    }

    // Update within a transaction
    const updated = await withTransaction(async (conn) => {
      return deviceRepo.updateMacAddress(conn, macId, {
        macType: body.macType,
        macAddress: body.macAddress,
      });
    });

    res.json({ data: updated });
  },

  /** DELETE /devices/:id/mac/:macId — remove a MAC address from a device. it_support / admin only. */
  async removeMac(req: Request, res: Response): Promise<void> {
    const deviceId = parsePositiveInt(req.params.id, 'device id');
    const macId = parsePositiveInt(req.params.macId, 'MAC id');

    // Verify the device exists
    const device = await deviceRepo.getByIdFull(deviceId);
    if (!device) {
      throw AppError.notFound('Device not found');
    }

    // Verify the MAC address belongs to this device
    const macs = await deviceRepo.getMacsByDeviceId(deviceId);
    const mac = macs.find((m) => m.id === macId);
    if (!mac) {
      throw AppError.notFound('MAC address not found on this device');
    }

    // Delete within a transaction
    await withTransaction(async (conn) => {
      await deviceRepo.removeMacAddress(conn, macId);
    });

    res.status(204).send();
  },

  /** POST /devices/:id/assign — assign device to a user. */
  async assignToUser(req: Request, res: Response): Promise<void> {
    const deviceId = parsePositiveInt(req.params.id, 'device id');
    const { userId, userName, userEmail, userDept, ticketId, reason } = req.body;

    if (!userName || !userEmail) {
      throw AppError.badRequest('userName and userEmail are required');
    }

    const device = await deviceRepo.getByIdFull(deviceId);
    if (!device) {
      throw AppError.notFound('Device not found');
    }

    // Assign device and log history in a transaction
    const updated = await deviceRepo.assignToUser(
      deviceId,
      userId || null,
      userName,
      userEmail,
      userDept || null,
      ticketId || null,
      reason || `Assigned to ${userName}`
    );
    res.json({ device: updated });
  },

  /** POST /devices/:id/checkout — checkout/return a device. */
  async checkout(req: Request, res: Response): Promise<void> {
    const deviceId = parsePositiveInt(req.params.id, 'device id');
    const body = req.body as z.infer<typeof checkoutDeviceSchema>;

    const device = await deviceRepo.getByIdFull(deviceId);
    if (!device) {
      throw AppError.notFound('Device not found');
    }

    if (device.status !== 'Active') {
      throw AppError.badRequest(`Device cannot be checked out. Current status: ${device.status}`);
    }

    // Determine new status based on action type
    const newStatus = body.actionType === 'replace' ? 'In Repair' : 'In Stock';

    // Checkout and update status in a transaction
    const updated = await deviceRepo.checkout(
      deviceId,
      body.condition,
      newStatus,
      body.notes,
      req.user?.name || 'System'
    );
    res.json({ device: updated });
  },

  /** GET /devices/reports/history — device assignment history. */
  async getHistoryReport(_req: Request, res: Response): Promise<void> {
    const history = await deviceRepo.getHistoryReport();
    res.json({ history });
  },

  /** GET /devices/reports/summary — device inventory summary. */
  async getSummaryReport(_req: Request, res: Response): Promise<void> {
    const summary = await deviceRepo.getSummaryReport();
    res.json({ summary });
  },

  /** GET /devices/reports/assignments — device to user mapping. */
  async getAssignmentsReport(req: Request, res: Response): Promise<void> {
    const filters: ReportFilters = {
      department: typeof req.query.department === 'string' ? req.query.department : undefined,
      deviceType: typeof req.query.deviceType === 'string' ? req.query.deviceType : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    };
    const assignments = await deviceRepo.getAssignmentsReport(filters);
    res.json({ assignments });
  },

  /** GET /devices/reports/aging — devices nearing warranty expiry. */
  async getAgingReport(req: Request, res: Response): Promise<void> {
    const filters: ReportFilters = {
      department: typeof req.query.department === 'string' ? req.query.department : undefined,
      deviceType: typeof req.query.deviceType === 'string' ? req.query.deviceType : undefined,
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
    };
    const aging = await deviceRepo.getAgingReport(filters);
    res.json({ aging });
  },

  /** GET /devices/reports/department — devices by department. */
  async getDepartmentReport(_req: Request, res: Response): Promise<void> {
    const departments = await deviceRepo.getByDepartmentReport();
    res.json({ departments });
  },

  /** GET /devices/reports/availability — device availability status. */
  async getAvailabilityReport(_req: Request, res: Response): Promise<void> {
    const availability = await deviceRepo.getAvailabilityReport();
    res.json({ availability });
  },

  /** GET /devices/reports/stock-movement — daily stock in/out. */
  async getStockMovementReport(_req: Request, res: Response): Promise<void> {
    const movement = await deviceRepo.getStockMovementReport();
    res.json({ movement });
  },

  /** GET /devices/reports/stock-by-type — devices grouped by type and status. */
  async getStockByTypeReport(_req: Request, res: Response): Promise<void> {
    const stockByType = await deviceRepo.getStockByTypeReport();
    res.json({ stockByType });
  },

  /** GET /devices/reports/unassigned — devices not assigned or awaiting return. */
  async getUnassignedReport(_req: Request, res: Response): Promise<void> {
    const unassigned = await deviceRepo.getUnassignedReport();
    res.json({ unassigned });
  },

  /** GET /devices/reports/by-user — devices per user. */
  async getByUserReport(_req: Request, res: Response): Promise<void> {
    const byUser = await deviceRepo.getByUserReport();
    res.json({ byUser });
  },
};
