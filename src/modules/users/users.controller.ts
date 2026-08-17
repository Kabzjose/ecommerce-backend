import type { Request, Response } from 'express';
import { usersService } from './users.service.js';
import type { Role } from '@prisma/client';

export const usersController = {
  async create(req: Request, res: Response) {
    const user = await usersService.createByAdmin(req.body);
    res.status(201).json({ user });
  },

  async list(req: Request, res: Response) {
    const { role, page, limit } = req.validated!.query as {
      role?: Role;
      page: number;
      limit: number;
    };
    const result = await usersService.list(role, page, limit);
    res.json(result);
  },

  async deactivate(req: Request, res: Response) {
    await usersService.deactivate(String(req.params.id), req.user!.id);
    res.status(204).send();
  },
};
