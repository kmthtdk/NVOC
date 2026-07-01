import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminController, updateApprovalConfigSchema } from '../controllers/admin.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';

export const adminRoutes = Router();

// Throttle admin endpoints — they read the user directory and control the whole
// approval chain (M-2).
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many admin requests. Please try again later.',
});

// All admin routes require a session; most are it_support/admin, config PUT is admin-only.
adminRoutes.use(authenticate, adminLimiter);

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
