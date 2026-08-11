import type { Request, Response } from 'express';
import { notificationsService } from './notifications.service.js';

export const notificationsController = {
  async getForBooking(req: Request, res: Response) {
    const logs = await notificationsService.getHistoryForBooking(String(req.params.bookingId));
    res.json({ logs });
  },
};
