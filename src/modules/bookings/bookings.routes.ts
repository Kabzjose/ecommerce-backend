import { Router } from 'express';
import { bookingsController } from './bookings.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import {
  createBookingSchema,
  updateStatusSchema,
  assignRiderSchema,
  listBookingsQuerySchema,
} from './bookings.schema.js';

export const bookingsRouter = Router();

// Auth guard applied once at the router level — every route below requires a valid token
bookingsRouter.use(requireAuth);

// POST /api/bookings — customers only; price is calculated server-side from the live quote
bookingsRouter.post(
  '/',
  requireRole('CUSTOMER'),
  validate(createBookingSchema),
  asyncHandler(bookingsController.create),
);

// GET /api/bookings — scoped by role inside the controller (customer → own, rider → assigned, admin → all)
bookingsRouter.get(
  '/',
  validate(listBookingsQuerySchema),
  asyncHandler(bookingsController.listMine),
);

// GET /api/bookings/:id — fine-grained resource-level access check happens inside the service
bookingsRouter.get('/:id', asyncHandler(bookingsController.getOne));

// GET /api/bookings/:id/location — REST fallback for the rider's last known position
// Real-time updates are pushed via WebSocket (booking:subscribe + location:changed events)
bookingsRouter.get('/:id/location', asyncHandler(bookingsController.getLocation));

// PATCH /api/bookings/:id/status — state machine enforced in the service
bookingsRouter.patch(
  '/:id/status',
  requireRole('RIDER', 'ADMIN'),
  validate(updateStatusSchema),
  asyncHandler(bookingsController.updateStatus),
);

// PATCH /api/bookings/:id/assign-rider — admin only; auto-confirms the booking
bookingsRouter.patch(
  '/:id/assign-rider',
  requireRole('ADMIN'),
  validate(assignRiderSchema),
  asyncHandler(bookingsController.assignRider),
);
