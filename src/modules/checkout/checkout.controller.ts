import type { Request, Response } from 'express';
import { checkoutService } from './checkout.service.js';

export const checkoutController = {
  async checkout(req: Request, res: Response) {
    const result = await checkoutService.checkout(req.user!.id, req.body);
    res.status(201).json({
      order: result.order,
      // Normalise: M-Pesa returns {message}, Card returns {authorizationUrl}
      payment: {
        message: (result.payment as any).message ?? 'Proceed to complete payment',
        ...result.payment,
      },
    });
  },
};
