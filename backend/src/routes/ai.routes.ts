import { Router } from 'express';
import { aiController, triageSchema } from '../controllers/ai.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/helpers.js';

export const aiRoutes = Router();

aiRoutes.post('/triage', authenticate, validateBody(triageSchema), asyncHandler(aiController.triage));
