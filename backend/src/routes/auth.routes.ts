import { Router } from 'express';
import { authController, loginSchema } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';

export const authRoutes = Router();

authRoutes.post('/login', validateBody(loginSchema), asyncHandler(authController.login));
authRoutes.get('/validate', authenticate, asyncHandler(authController.validate));
