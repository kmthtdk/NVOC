import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { categoryRoutes } from './category.routes.js';
import { ticketRoutes } from './ticket.routes.js';
import { attachmentRoutes } from './attachment.routes.js';
import { aiRoutes } from './ai.routes.js';
import { deviceRoutes } from './device.routes.js';
import { isDbUp } from '../config/db.js';
import { asyncHandler } from '../utils/helpers.js';

export const apiRouter = Router();

// Health probe (no auth) — used by Docker healthcheck and load balancers.
apiRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const dbUp = await isDbUp();
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
  }),
);

apiRouter.use('/auth', authRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/tickets', ticketRoutes);
apiRouter.use('/attachments', attachmentRoutes);
apiRouter.use('/ai', aiRoutes);
apiRouter.use('/devices', deviceRoutes);
