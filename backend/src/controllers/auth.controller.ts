import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env, isProd } from '../config/env.js';
import { userRepo } from '../models/user.repo.js';
import { mapPublicUser } from '../models/mappers.js';
import { AppError } from '../utils/AppError.js';
import { DEMO_PASSWORD_HASH } from '../config/adminBootstrap.js';
import type { JwtPayload } from '../types/index.js';

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN } as jwt.SignOptions);
}

export const authController = {
  /** POST /auth/login — verify credentials, return JWT + public user. */
  async login(req: Request, res: Response): Promise<void> {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const user = await userRepo.findByEmail(email);
    // Constant-ish path: always run a compare to reduce user-enumeration timing signal.
    const hash = user?.password_hash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
    const ok = await bcrypt.compare(password, hash);

    if (!user || !ok) {
      throw AppError.unauthorized('Invalid email or password');
    }

    // Defense-in-depth (M-5): reject seeded demo accounts (still on the default
    // password) in production at LOGIN time — survives a DB re-seed that would
    // otherwise re-activate them without a backend restart.
    if (isProd && user.password_hash === DEMO_PASSWORD_HASH) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const publicUser = mapPublicUser(user);
    const token = signToken({
      sub: publicUser.id,
      email: publicUser.email,
      role: publicUser.role,
      name: publicUser.fullName,
    });

    res.json({ token, user: publicUser });
  },

  /** GET /auth/validate — confirm token still valid, re-hydrate fresh user. */
  async validate(req: Request, res: Response): Promise<void> {
    if (!req.user) throw AppError.unauthorized();
    const user = await userRepo.findById(Number(req.user.sub));
    if (!user) throw AppError.unauthorized('User no longer exists');
    res.json({ valid: true, user: mapPublicUser(user) });
  },
};
