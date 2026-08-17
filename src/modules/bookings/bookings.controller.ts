import type { Request, Response } from 'express';
import { bookingsService } from './bookings.service.js';
import { BadRequestError } from '../../lib/errors.js';
import type { BookingStatus } from '@prisma/client';

export const bookingsController = {
  async create(req: Request, res: Response) {
    const result = await bookingsService.create(req.user!.id, req.body);
    res.status(201).json({
      booking: result.booking,
      payment: result.payment,
    });
  },

  async getOne(req: Request, res: Response) {
    const booking = await bookingsService.getById(String(req.params.id), req.user!);
    res.json({ booking });
  },

  async listMine(req: Request, res: Response) {
    // Validated query values come through as their coerced types after validate() middleware
    const { status, page, limit } = req.validated!.query as {
      status?: BookingStatus;
      page: number;
      limit: number;
    };

    if (req.user!.role === 'RIDER') {
      const result = await bookingsService.listForRider(req.user!.id, status, page, limit);
      return res.json(result);
    }
    if (req.user!.role === 'ADMIN') {
      const result = await bookingsService.listAll(status, page, limit);
      return res.json(result);
    }
    const result = await bookingsService.listForCustomer(req.user!.id, status, page, limit);
    return res.json(result);
  },

  async updateStatus(req: Request, res: Response) {
    const booking = await bookingsService.updateStatus(
      String(req.params.id),
      req.body.status,
      req.body.note,
      req.user!,
    );
    res.json({ booking });
  },

  async assignRider(req: Request, res: Response) {
    if (!req.body.riderId) {
      throw new BadRequestError('riderId is required');
    }
    const booking = await bookingsService.assignRider(String(req.params.id), req.body.riderId);
    res.json({ booking });
  },

  // REST fallback for clients that can't use WebSockets (e.g. polling from a native app)
  // Uses the same getById auth check — customer/rider/admin gating is already handled there
  async getLocation(req: Request, res: Response) {
    const booking = await bookingsService.getById(String(req.params.id), req.user!);
    res.json({
      bookingId: booking.id,
      lat: booking.riderLat ?? null,
      lng: booking.riderLng ?? null,
      updatedAt: booking.riderLocatedAt ?? null,
    });
  },
};
