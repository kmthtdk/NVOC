import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler so thrown/rejected errors flow to the error
 * middleware instead of crashing the process (no try/catch in every handler).
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Convert a mysql2 `dateStrings` value ("YYYY-MM-DD HH:MM:SS", stored UTC)
 * to an ISO-8601 string with explicit Z. Pass-through for null.
 */
export function toIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  // mysql2 returns "2026-06-16 16:30:00" (UTC because we set timezone:'Z')
  const normalized = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? value : d.toISOString();
}

/** DATE column ("YYYY-MM-DD") pass-through, normalized to date-only or null. */
export function toDateOnly(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

/**
 * Robustly coerce a JSON column value into an object. mysql2 usually returns a
 * parsed object for JSON columns, but we defensively handle strings too.
 */
export function parseJsonColumn(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'object') return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}
