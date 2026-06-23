import { Router } from 'express';
import { attachmentController } from '../controllers/attachment.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';

export const attachmentRoutes = Router();

attachmentRoutes.get('/:id', authenticate, asyncHandler(attachmentController.download));
