import { Router } from 'express';
import { deviceController } from '../controllers/device.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';
import { createDeviceSchema, updateDeviceSchema } from '../controllers/device.controller.js';

export const deviceRoutes = Router();

// Read endpoints — any authenticated user.
// NOTE: /search must be registered before /:id so "search" isn't captured as an id.
deviceRoutes.get('/search', authenticate, asyncHandler(deviceController.search));
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

// Delete — admin only.
deviceRoutes.delete(
  '/:id',
  authenticate,
  requireRole('admin'),
  asyncHandler(deviceController.remove),
);
