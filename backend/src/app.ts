import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRouter } from './routes/index.js';
import { isDbUp } from './config/db.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { asyncHandler } from './utils/helpers.js';

/** Build the Express app (separated from server bootstrap for testability). */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind Nginx reverse proxy

  // Security headers. crossOriginResourcePolicy relaxed so the SPA can pull files.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  // CORS — allow the configured frontend origin, with credentials.
  app.use(
    cors({
      origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    }),
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Structured request logging.
  app.use(pinoHttp({ logger }));

  // Root-level health (Dockerfile HEALTHCHECK hits /health directly).
  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const dbUp = await isDbUp();
      res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
    }),
  );

  // API surface.
  app.use('/api', apiRouter);

  // 404 + central error handler (must be last).
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
