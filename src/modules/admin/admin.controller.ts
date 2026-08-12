import type { Request, Response } from 'express';
import { adminService } from './admin.service.js';
import { NotFoundError } from '../../lib/errors.js';
import { prisma } from '../../config/db.js';

export const adminController = {
  async overview(_req: Request, res: Response) {
    const stats = await adminService.getOverview();
    res.json(stats);
  },

  async allRidersPerformance(req: Request, res: Response) {
    const { page, limit } = req.query as unknown as { page: number; limit: number };
    const result = await adminService.getAllRidersPerformance(page, limit);
    res.json(result);
  },

  async singleRiderPerformance(req: Request, res: Response) {
    const rider = await prisma.user.findUnique({ where: { id: String(req.params.id) } });
    if (!rider || rider.role !== 'RIDER') {
      throw new NotFoundError('Rider not found');
    }
    const performance = await adminService.getSingleRiderPerformance(String(req.params.id));
    res.json({ rider: { id: rider.id, name: rider.name, phone: rider.phone }, performance });
  },

  async revenue(req: Request, res: Response) {
    const { days } = req.query as unknown as { period: string; days: number };
    const revenue = await adminService.getRevenue(days);
    res.json({ revenue });
  },
};
