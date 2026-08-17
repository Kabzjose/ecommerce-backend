import type { Request, Response } from 'express';
import { ordersRepository } from './orders.repository.js';
import { NotFoundError } from '../../lib/errors.js';

export const ordersController = {
  async getOne(req: Request, res: Response) {
    const order = await ordersRepository.findByIdForUser(String(req.params.id), req.user!.id);
    if (!order) throw new NotFoundError('Order not found');
    res.json({ order });
  },

  async listMine(req: Request, res: Response) {
    const { page, limit } = req.validated!.query as { page: number; limit: number };
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ordersRepository.listForCustomer(req.user!.id, skip, limit),
      ordersRepository.countForCustomer(req.user!.id),
    ]);
    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) });
  },
};
