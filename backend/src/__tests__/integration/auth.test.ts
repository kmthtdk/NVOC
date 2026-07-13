import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { pool } from '../../config/db.js';
import { authController } from '../../controllers/auth.controller.js';
import { userRepo } from '../../models/user.repo.js';
import { env } from '../../config/env.js';

/**
 * auth.controller had zero tests. Login is the one endpoint every user hits and
 * the one place a regression is unrecoverable, so it gets real bcrypt hashes and
 * a real users table rather than a mock that would happily "authenticate" anyone.
 */

const PASSWORD = 'C0rrect-Horse!';
const EMAIL = 'authtest@company.com';
const INACTIVE_EMAIL = 'disabled@company.com';

/** Minimal Express doubles — the controller only ever calls res.json(). */
const fakeRes = () => {
  const captured: { body?: unknown } = {};
  const res = {
    json: (b: unknown) => {
      captured.body = b;
      return res;
    },
  } as unknown as Response;
  return { res, captured };
};

const reqWith = (email: string, password: string) => ({ body: { email, password } }) as Request;

beforeAll(async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [EMAIL, INACTIVE_EMAIL]);
  await pool.query(
    `INSERT INTO users (full_name, email, password_hash, role, department, is_active)
     VALUES (?, ?, ?, 'it_support', 'IT', 1), (?, ?, ?, 'requester', 'IT', 0)`,
    ['Auth Test', EMAIL, hash, 'Disabled User', INACTIVE_EMAIL, hash],
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM users WHERE email IN (?, ?)', [EMAIL, INACTIVE_EMAIL]);
  await pool.end();
});

describe('authController.login', () => {
  it('issues a JWT carrying the user id, role and email', async () => {
    const { res, captured } = fakeRes();
    await authController.login(reqWith(EMAIL, PASSWORD), res);

    const body = captured.body as { token: string; user: { email: string; role: string } };
    expect(body.user.email).toBe(EMAIL);
    expect(body.user.role).toBe('it_support');

    // The token must actually verify against the configured secret — a signature
    // that only *looks* right is the whole class of bug here.
    const decoded = jwt.verify(body.token, env.JWT_SECRET) as Record<string, unknown>;
    expect(decoded.email).toBe(EMAIL);
    expect(decoded.role).toBe('it_support');
    expect(decoded.exp).toBeTypeOf('number');
  });

  it('never returns the password hash to the client', async () => {
    const { res, captured } = fakeRes();
    await authController.login(reqWith(EMAIL, PASSWORD), res);

    expect(JSON.stringify(captured.body)).not.toContain('$2a$');
  });

  it('rejects a wrong password', async () => {
    const { res } = fakeRes();
    await expect(authController.login(reqWith(EMAIL, 'wrong-password'), res)).rejects.toMatchObject({
      statusCode: 401,
    });
  });

  it('gives an unknown email the same error as a wrong password (no enumeration)', async () => {
    const { res } = fakeRes();
    await expect(
      authController.login(reqWith('nobody@company.com', PASSWORD), res),
    ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
  });

  it('refuses a deactivated account even with the right password', async () => {
    // findByEmail filters is_active, so a disabled user must be indistinguishable
    // from a non-existent one.
    expect(await userRepo.findByEmail(INACTIVE_EMAIL)).toBeNull();

    const { res } = fakeRes();
    await expect(authController.login(reqWith(INACTIVE_EMAIL, PASSWORD), res)).rejects.toMatchObject({
      statusCode: 401,
    });
  });
});
