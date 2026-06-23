import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { logger } from '../config/logger.js';
import { isProd } from '../config/env.js';

/** 404 fallthrough for unknown routes. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

interface MysqlError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

/**
 * Central error handler. Produces the standard envelope:
 *   { error: { code, message, details? } }
 * Translates known Zod / MySQL errors to friendly responses; hides internals in prod.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  // Zod validation error -> 400 with field details
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  // Our typed application errors
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, path: req.originalUrl }, err.message);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  // Known MySQL errors -> friendly mapping
  const my = err as MysqlError;
  if (my && typeof my.code === 'string') {
    if (my.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with this value already exists' } });
      return;
    }
    if (my.code === 'ER_NO_REFERENCED_ROW_2' || my.code === 'ER_NO_REFERENCED_ROW') {
      res.status(400).json({ error: { code: 'INVALID_REFERENCE', message: 'Referenced record does not exist' } });
      return;
    }
  }

  // Multer upload errors expose a `code` like LIMIT_FILE_SIZE
  if (my && typeof my.code === 'string' && my.code.startsWith('LIMIT_')) {
    res.status(400).json({ error: { code: my.code, message: my.message } });
    return;
  }

  // Unknown -> 500, log full detail, hide internals from client in prod
  logger.error({ err, path: req.originalUrl }, 'Unhandled error');
  res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: isProd ? 'Internal server error' : String((err as Error)?.message ?? err),
    },
  });
}
