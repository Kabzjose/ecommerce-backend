import type { Request, Response } from 'express';
import { cartService } from './cart.service.js';

export const cartController = {
  async getCart(req: Request, res: Response) {
    const cart = await cartService.getCart(req.user!.id);
    res.json(cart);
  },

  async addItem(req: Request, res: Response) {
    const cart = await cartService.addItem(req.user!.id, req.body.productId, req.body.quantity);
    res.status(201).json(cart);
  },

  async updateItem(req: Request, res: Response) {
    const cart = await cartService.updateItemQuantity(req.user!.id, req.params.productId as string, req.body.quantity);
    res.json(cart);
  },

  async removeItem(req: Request, res: Response) {
    const cart = await cartService.removeItem(req.user!.id, req.params.productId as string);
    res.json(cart);
  },

  async clear(req: Request, res: Response) {
    await cartService.clear(req.user!.id);
    res.status(204).send();
  },
};
