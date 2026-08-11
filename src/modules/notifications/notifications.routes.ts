import { Router } from 'express';
import { notificationsController } from './notifications.controller.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware .js';
import { requireRole } from '../../middleware/role.middleware.js';

export const notificationsRouter = Router();

// Admin-only — for debugging: "what SMSes did we send for this booking?"
notificationsRouter.get(
  '/booking/:bookingId',
  requireAuth,
  requireRole('ADMIN'),
  asyncHandler(notificationsController.getForBooking),
);
