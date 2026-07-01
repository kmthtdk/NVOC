import { Router } from 'express';
import { adminController, updateApprovalConfigSchema } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';

export const adminRoutes = Router();

// All admin routes require a session; most are it_support/admin, config PUT is admin-only.
adminRoutes.use(authenticate);

adminRoutes.get('/users', requireRole('it_support', 'admin'), asyncHandler(adminController.listUsers));
adminRoutes.get(
  '/approval/config',
  requireRole('it_support', 'admin'),
  asyncHandler(adminController.getApprovalConfig),
);
adminRoutes.put(
  '/approval/config',
  requireRole('admin'),
  validateBody(updateApprovalConfigSchema),
  asyncHandler(adminController.updateApprovalConfig),
);
