import { Router } from 'express';
import { categoryController } from '../controllers/category.controller.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/helpers.js';

export const categoryRoutes = Router();

categoryRoutes.get('/', authenticate, asyncHandler(categoryController.list));
