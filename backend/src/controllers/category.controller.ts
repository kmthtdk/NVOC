import type { Request, Response } from 'express';
import { categoryRepo } from '../models/category.repo.js';

export const categoryController = {
  /** GET /categories — full nested taxonomy for the request form. */
  async list(_req: Request, res: Response): Promise<void> {
    const taxonomy = await categoryRepo.getTaxonomy();
    res.json(taxonomy);
  },
};
