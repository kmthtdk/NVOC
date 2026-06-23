import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Validate & coerce req.body against a Zod schema. On success, replaces req.body
 * with the parsed (typed, coerced) value. On failure, the ZodError propagates
 * to the error handler which renders field-level details.
 *
 * Query validation is handled inline in the controllers (parsing req.query
 * directly) because Express types req.query as read-only.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}
