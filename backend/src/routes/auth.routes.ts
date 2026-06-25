import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController, loginSchema } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';

export const authRoutes = Router();

// Rate limit login attempts: 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many login attempts. Please try again later.',
  skip: (req) => req.method !== 'POST',
});

authRoutes.post('/login', loginLimiter, validateBody(loginSchema), asyncHandler(authController.login));
authRoutes.get('/validate', authenticate, asyncHandler(authController.validate));
