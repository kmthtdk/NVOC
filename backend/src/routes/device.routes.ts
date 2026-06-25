import { Router } from 'express';
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

// Read endpoints — any authenticated user.
// NOTE: /search and /reports must be registered before /:id so they aren't captured as ids.
deviceRoutes.get('/search', authenticate, asyncHandler(deviceController.search));
deviceRoutes.get('/reports/history', authenticate, asyncHandler(deviceController.getHistoryReport));
deviceRoutes.get('/reports/summary', authenticate, asyncHandler(deviceController.getSummaryReport));
deviceRoutes.get('/reports/assignments', authenticate, asyncHandler(deviceController.getAssignmentsReport));
deviceRoutes.get('/reports/aging', authenticate, asyncHandler(deviceController.getAgingReport));
deviceRoutes.get('/reports/department', authenticate, asyncHandler(deviceController.getDepartmentReport));
deviceRoutes.get('/reports/availability', authenticate, asyncHandler(deviceController.getAvailabilityReport));
deviceRoutes.get('/reports/stock-movement', authenticate, asyncHandler(deviceController.getStockMovementReport));
deviceRoutes.get('/reports/stock-by-type', authenticate, asyncHandler(deviceController.getStockByTypeReport));
deviceRoutes.get('/reports/unassigned', authenticate, asyncHandler(deviceController.getUnassignedReport));
deviceRoutes.get('/reports/by-user', authenticate, asyncHandler(deviceController.getByUserReport));
deviceRoutes.get('/', authenticate, asyncHandler(deviceController.list));
deviceRoutes.get('/:id', authenticate, asyncHandler(deviceController.get));

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
  validateBody(assignDeviceSchema),
  asyncHandler(deviceController.assignToUser),
);

// Checkout device — it_support and admin.
deviceRoutes.post(
  '/:id/checkout',
  authenticate,
  requireRole('it_support', 'admin'),
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
