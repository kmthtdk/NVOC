import mysql, { type Pool, type PoolConnection } from 'mysql2/promise';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Shared MySQL connection pool. mysql2/promise gives us async/await + pooling.
 *
 * dateStrings: true  -> TIMESTAMP/DATE columns come back as strings (not JS Date),
 *   which keeps serialization deterministic and avoids implicit local-tz shifts.
 *   We convert these to ISO-8601 in the mappers so the frontend gets stable values.
 *
 * Note on JSON columns: mysql2 auto-parses JSON columns into JS objects on read,
 *   and we explicitly JSON.stringify on write. The mappers also defensively handle
 *   the string case in `parseJsonColumn` to be robust across driver versions.
 */
export const pool: Pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  queueLimit: 0,
  dateStrings: true,
  charset: 'utf8mb4',
  timezone: 'Z', // interpret/emit DATETIME/TIMESTAMP as UTC
  namedPlaceholders: false,
});

/** Verify connectivity at boot; throws if the DB is unreachable. */
export async function assertDbConnection(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
    logger.info('Database connection established');
  } finally {
    conn.release();
  }
}

/** Lightweight health probe used by GET /health. */
export async function isDbUp(): Promise<boolean> {
  try {
    const conn = await pool.getConnection();
    try {
      await conn.ping();
      return true;
    } finally {
      conn.release();
    }
  } catch {
    return false;
  }
}

/**
 * Run a function inside a transaction. Commits on success, rolls back on throw.
 * Used for code generation + ticket insert, and multi-row writes.
 */
export async function withTransaction<T>(
  fn: (conn: PoolConnection) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore rollback failure */
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
