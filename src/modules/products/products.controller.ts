import type { Request, Response } from 'express';
import { productsService } from './products.service.js';

export const productsController = {
  async create(req: Request, res: Response) {
    const product = await productsService.create(req.body);
    res.status(201).json({ product });
  },

  async getOne(req: Request, res: Response) {
    // Optional chaining — req.user is undefined for unauthenticated requests on this public route
    const isAdmin = req.user?.role === 'ADMIN';
    const product = await productsService.getById(String(req.params.id), isAdmin);
    res.json({ product });
  },

  async list(req: Request, res: Response) {
    const { category, search, page, limit } = req.query as unknown as {
      category?: string;
      search?: string;
      page: number;
      limit: number;
    };
    const isAdmin = req.user?.role === 'ADMIN';
    const result = await productsService.list({ category, search, page, limit, asAdmin: isAdmin });
    res.json(result);
  },

  async update(req: Request, res: Response) {
    const product = await productsService.update(String(req.params.id), req.body);
    res.json({ product });
  },

  async deactivate(req: Request, res: Response) {
    await productsService.deactivate(String(req.params.id));
    res.status(204).send();
  },
};
