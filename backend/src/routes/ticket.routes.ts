import { Router } from 'express';
import {
  ticketController,
  createTicketSchema,
  updateTicketSchema,
  createCommentSchema,
  linkDeviceSchema,
} from '../controllers/ticket.controller.js';
import { attachmentController } from '../controllers/attachment.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { upload } from '../middleware/upload.js';
import { asyncHandler } from '../utils/helpers.js';

export const ticketRoutes = Router();

// All ticket routes require a valid session.
ticketRoutes.use(authenticate);

ticketRoutes.get('/stats/summary', asyncHandler(ticketController.getStatsSummary));
ticketRoutes.get('/stats/recent', asyncHandler(ticketController.getStatsRecent));
ticketRoutes.get('/reports/pending-hardware', asyncHandler(ticketController.getPendingHardwareReport));
ticketRoutes.get('/reports/fulfillment-time', asyncHandler(ticketController.getFulfillmentTimeReport));
ticketRoutes.get('/reports/age-buckets', asyncHandler(ticketController.getAgeBucketsReport));
ticketRoutes.get('/reports/category-trend', asyncHandler(ticketController.getCategoryTrendReport));
ticketRoutes.get('/', asyncHandler(ticketController.list));
ticketRoutes.get('/:id', asyncHandler(ticketController.get));
ticketRoutes.post('/', validateBody(createTicketSchema), asyncHandler(ticketController.create));

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
  validateBody(createCommentSchema),
  asyncHandler(ticketController.addComment),
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
  upload.array('files', 10),
  asyncHandler(attachmentController.upload),
);
