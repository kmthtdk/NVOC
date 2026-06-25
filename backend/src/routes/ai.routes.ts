import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { aiController, triageSchema } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';

export const aiRoutes = Router();

// Strict rate limit for AI triage — most expensive endpoint (external API cost).
const aiTriageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many AI triage requests. Please try again later.',
});

aiRoutes.post('/triage', authenticate, aiTriageLimiter, validateBody(triageSchema), asyncHandler(aiController.triage));
