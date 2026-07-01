import type { Request, Response } from 'express';
import { z } from 'zod';
import { userRepo } from '../models/user.repo.js';
import { approvalService } from '../services/approval.service.js';

export const updateApprovalConfigSchema = z.object({
  steps: z
    .array(
      z.object({
        approverType: z.enum(['requester_leader', 'it_leader', 'user', 'role']),
        approverUserId: z.number().int().positive().nullable().optional(),
        label: z.string().max(150).nullable().optional(),
      }),
    )
    .min(1)
    .optional(),
  itLeaderUserId: z.number().int().positive().nullable().optional(),
  approvalEnabled: z.boolean().optional(),
  departmentLeaders: z
    .array(
      z.object({
        department: z.string().min(1).max(150),
        leaderUserId: z.number().int().positive().nullable(),
      }),
    )
    .optional(),
});

export const adminController = {
  /** GET /admin/users — active users, for approver pickers. */
  async listUsers(_req: Request, res: Response): Promise<void> {
    const users = (await userRepo.listActive()).map((u) => ({
      id: u.id,
      fullName: u.full_name,
      email: u.email,
      role: u.role,
      department: u.department,
    }));
    res.json({ users });
  },

  /** GET /admin/approval/config — default flow + leader settings. */
  async getApprovalConfig(_req: Request, res: Response): Promise<void> {
    res.json(await approvalService.getConfig());
  },

  /** PUT /admin/approval/config — update default flow + leader settings (admin). */
  async updateApprovalConfig(req: Request, res: Response): Promise<void> {
    const body = req.body as z.infer<typeof updateApprovalConfigSchema>;
    res.json(await approvalService.updateConfig(body));
  },
};
