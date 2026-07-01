import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { deviceController } from '../controllers/device.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';
import {
  createDeviceSchema,
  updateDeviceSchema,
  updateMacSchema,
  checkoutDeviceSchema,
  assignDeviceSchema,
  macAddressSchema,
} from '../controllers/device.controller.js';

export const deviceRoutes = Router();

// Rate limiter for device mutation endpoints (DoS prevention).
const deviceMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});

// Read endpoints — it_support/admin only. Device inventory exposes serials,
// personnel assignment (PII), and procurement data (cost/supplier/PO); requesters
// have no legitimate need for it (H-2).
// NOTE: /search and /reports must be registered before /:id so they aren't captured as ids.
deviceRoutes.get('/search', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.search));
deviceRoutes.get('/reports/history', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getHistoryReport));
deviceRoutes.get('/reports/summary', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getSummaryReport));
deviceRoutes.get('/reports/assignments', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getAssignmentsReport));
deviceRoutes.get('/reports/aging', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getAgingReport));
deviceRoutes.get('/reports/department', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getDepartmentReport));
deviceRoutes.get('/reports/availability', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getAvailabilityReport));
deviceRoutes.get('/reports/stock-movement', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getStockMovementReport));
deviceRoutes.get('/reports/stock-by-type', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getStockByTypeReport));
deviceRoutes.get('/reports/unassigned', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getUnassignedReport));
deviceRoutes.get('/reports/by-user', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.getByUserReport));
deviceRoutes.get('/', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.list));
deviceRoutes.get('/:id', authenticate, requireRole('it_support', 'admin'), asyncHandler(deviceController.get));

// Mutations — it_support and admin.
deviceRoutes.post(
  '/',
  authenticate,
  requireRole('it_support', 'admin'),
  validateBody(createDeviceSchema),
  asyncHandler(deviceController.create),
);

deviceRoutes.put(
  '/:id',
  authenticate,
  requireRole('it_support', 'admin'),
  validateBody(updateDeviceSchema),
  asyncHandler(deviceController.update),
);

// Assign device to user — it_support and admin.
deviceRoutes.post(
  '/:id/assign',
  authenticate,
  requireRole('it_support', 'admin'),
  deviceMutationLimiter,
  validateBody(assignDeviceSchema),
  asyncHandler(deviceController.assignToUser),
);

// Checkout device — it_support and admin.
deviceRoutes.post(
  '/:id/checkout',
  authenticate,
  requireRole('it_support', 'admin'),
  deviceMutationLimiter,
  validateBody(checkoutDeviceSchema),
  asyncHandler(deviceController.checkout),
);

// Delete — admin only.
deviceRoutes.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(deviceController.remove),
);

// MAC address management — it_support and admin.
// NOTE: Must be registered after the main device routes so /:id is captured first.
deviceRoutes.post(
  '/:id/mac',
  authenticate,
  requireRole('it_support', 'admin'),
  validateBody(macAddressSchema),
  asyncHandler(deviceController.createMac),
);

deviceRoutes.put(
  '/:id/mac/:macId',
  authenticate,
  requireRole('it_support', 'admin'),
  validateBody(updateMacSchema),
  asyncHandler(deviceController.updateMac),
);

deviceRoutes.delete(
  '/:id/mac/:macId',
  authenticate,
  requireRole('it_support', 'admin'),
  asyncHandler(deviceController.removeMac),
);
