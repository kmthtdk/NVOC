import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { env, isProd } from './env.js';
import { logger } from './logger.js';

/**
 * bcrypt hash of the demo password "Passw0rd!" shipped in
 * database/init/02_seed.sql (cost 10). In production we disable any account
 * still carrying it, so the well-known demo credentials can never grant access.
 */
export const DEMO_PASSWORD_HASH = '$2a$10$S4stxttvBHccVzRgHnKaQ.HCLXNNIAj0.O90RWAf0BayEzmnBMZ/W';

/**
 * Boot-time auth hardening. Runs once at startup:
 *  1. If ADMIN_EMAIL + ADMIN_PASSWORD are set, create/update a real admin from
 *     them (production never depends on the seeded demo password).
 *  2. In production, deactivate any user still using the shipped demo password
 *     hash — closing the known-credential hole (SEC-CRIT-2).
 */
export async function bootstrapAuth(): Promise<void> {
  // Weak-secret guard (C-2): a guessable JWT_SECRET lets anyone forge admin
  // tokens. Zod enforces length ≥16 but not entropy. In production this is fatal
  // — starting anyway would leave admin impersonation wide open.
  const isWeakSecret =
    /demo|change|secret|example|test|password/i.test(env.JWT_SECRET) || env.JWT_SECRET.length < 32;
  if (isWeakSecret) {
    const advice =
      'JWT_SECRET is weak or guessable — generate a random 32+ byte secret ' +
      '(`openssl rand -hex 32`) and supply it via a secrets manager.';
    if (isProd) {
      logger.fatal(advice);
      process.exit(1);
    }
    logger.warn(`${advice} (refusing to start with this secret once NODE_ENV=production)`);
  }

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    const hash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, department, title, is_active)
       VALUES (?, ?, ?, 'admin', 'IT Operations', 'IT Administrator', 1)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin', is_active = 1`,
      ['System Admin', env.ADMIN_EMAIL, hash],
    );
    logger.info({ email: env.ADMIN_EMAIL }, 'Admin ensured from ADMIN_EMAIL/ADMIN_PASSWORD');
  } else if (isProd) {
    logger.warn(
      'ADMIN_EMAIL/ADMIN_PASSWORD not set — no env-provisioned admin. Set them so ' +
        'production does not depend on seeded demo accounts.',
    );
  }

  if (isProd) {
    const [res] = await pool.query(
      'UPDATE users SET is_active = 0 WHERE password_hash = ? AND is_active = 1',
      [DEMO_PASSWORD_HASH],
    );
    const disabled = (res as { affectedRows: number }).affectedRows;
    if (disabled > 0) {
      logger.warn(
        { disabled },
        'Disabled seeded demo accounts still using the default password (production hardening)',
      );
    }
  }
}
