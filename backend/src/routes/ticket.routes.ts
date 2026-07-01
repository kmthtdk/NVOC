import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  ticketController,
  createTicketSchema,
  updateTicketSchema,
  createCommentSchema,
  linkDeviceSchema,
} from '../controllers/ticket.controller.js';
import { attachmentController } from '../controllers/attachment.controller.js';
import {
  approvalController,
  decideSchema,
  assignApproverSchema,
} from '../controllers/approval.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/helpers.js';

export const ticketRoutes = Router();

// Rate limiters for mutation endpoints (DoS prevention).
const ticketMutationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests. Please try again later.',
});

const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many comment submissions. Please try again later.',
});

const attachmentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many file uploads. Please try again later.',
});

// All ticket routes require a valid session.
ticketRoutes.use(authenticate);

// Org-wide stats expose aggregate counts and other requesters' recent tickets
// (PII). Restrict to IT/admin — requesters have no legitimate use for global
// stats and must not see tickets they didn't file (matches the list/detail IDOR
// fix). Only the orphaned Dashboard.tsx consumed these, so no live UI breaks.
ticketRoutes.get('/stats/summary', requireRole('it_support', 'admin'), asyncHandler(ticketController.getStatsSummary));
ticketRoutes.get('/stats/recent', requireRole('it_support', 'admin'), asyncHandler(ticketController.getStatsRecent));
ticketRoutes.get('/reports/pending-hardware', requireRole('it_support', 'admin'), asyncHandler(ticketController.getPendingHardwareReport));
ticketRoutes.get('/reports/fulfillment-time', requireRole('it_support', 'admin'), asyncHandler(ticketController.getFulfillmentTimeReport));
ticketRoutes.get('/reports/age-buckets', requireRole('it_support', 'admin'), asyncHandler(ticketController.getAgeBucketsReport));
ticketRoutes.get('/reports/category-trend', requireRole('it_support', 'admin'), asyncHandler(ticketController.getCategoryTrendReport));
// Approver inbox — must be before '/:id' so it isn't shadowed.
ticketRoutes.get('/approvals/inbox', asyncHandler(approvalController.inbox));

ticketRoutes.get('/', asyncHandler(ticketController.list));
ticketRoutes.get('/:id', asyncHandler(ticketController.get));
ticketRoutes.post('/', ticketMutationLimiter, validateBody(createTicketSchema), asyncHandler(ticketController.create));

// Status / assignment changes: IT support or admin only.
ticketRoutes.put(
  '/:id',
  requireRole('it_support', 'admin'),
  validateBody(updateTicketSchema),
  asyncHandler(ticketController.update),
);

// Deletion: admin only.
ticketRoutes.delete('/:id', requireRole('admin'), asyncHandler(ticketController.remove));

// Comments.
ticketRoutes.post(
  '/:id/comments',
  commentLimiter,
  validateBody(createCommentSchema),
  asyncHandler(ticketController.addComment),
);

// Approval decisions. The service authorizes the caller as the active step's
// approver (or it_support/admin); assigning an approver is it_support/admin only.
ticketRoutes.post(
  '/:id/approvals/:step/decide',
  validateBody(decideSchema),
  asyncHandler(approvalController.decide),
);
ticketRoutes.post(
  '/:id/approvals/:step/assign',
  requireRole('it_support', 'admin'),
  validateBody(assignApproverSchema),
  asyncHandler(approvalController.assign),
);

// Link device to ticket (create ticket_device_link)
ticketRoutes.post(
  '/:id/link-device',
  requireRole('it_support', 'admin'),
  validateBody(linkDeviceSchema),
  asyncHandler(ticketController.linkDevice),
);

// Attachments (multipart). `upload.array` runs before the handler.
ticketRoutes.post(
  '/:id/attachments',
  attachmentLimiter,
  upload.array('files', 10),
  asyncHandler(attachmentController.upload),
);
