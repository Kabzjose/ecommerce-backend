import { bookingsRepository } from './bookings.repository.js';
import { pricingService } from '../pricing/pricing.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateBookingInput } from './bookings.schema.js';
import type { BookingStatus, Role } from '@prisma/client';

// State machine — the single source of truth for legal lifecycle transitions.
// Illegal jumps (e.g. PENDING → DELIVERED) are rejected before touching the DB.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  AWAITING_PAYMENT: ['PENDING', 'CANCELLED'], // system-driven only — set by payment callback
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const bookingsService = {
  async create(customerId: string, input: CreateBookingInput) {
    // Always derive the price from the live pricing service — no client-supplied price accepted
    const quote = await pricingService.calculateQuote({
      pickupZoneId: input.pickupZoneId,
      dropoffZoneId: input.dropoffZoneId,
      packageType: input.packageType,
      weightKg: input.weightKg,
    });

    // Explicit field list — payerPhone is input-only and must not reach the Booking model
    const booking = await bookingsRepository.create({
      customerId,
      recipientName: input.recipientName,
      recipientPhone: input.recipientPhone,
      pickupZoneId: input.pickupZoneId,
      pickupAddress: input.pickupAddress,
      dropoffZoneId: input.dropoffZoneId,
      dropoffAddress: input.dropoffAddress,
      packageType: input.packageType,
      weightKg: input.weightKg,
      specialInstructions: input.specialInstructions,
      price: quote.price,
    });

    // Branch on payment method — Zod .refine() above guarantees the right field is present
    const payment =
      input.paymentMethod === 'MPESA'
        ? await paymentsService.initiateMpesa(booking.id, input.payerPhone!, quote.price)
        : await paymentsService.initiateCard(booking.id, input.payerEmail!, quote.price);

    return { booking, payment };
  },

  async getById(bookingId: string, requester: { id: string; role: Role }) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Fine-grained access check: resource-level, not just role-level
    const isOwner = booking.customerId === requester.id;
    const isAssignedRider = booking.riderId === requester.id;
    const isStaff = requester.role === 'ADMIN';

    if (!isOwner && !isAssignedRider && !isStaff) {
      throw new ForbiddenError('You do not have access to this booking');
    }

    return booking;
  },

  async listForCustomer(
    customerId: string,
    status: BookingStatus | undefined,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      bookingsRepository.findMany({ customerId, status, skip, take: limit }),
      bookingsRepository.count({ customerId, status }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listForRider(
    riderId: string,
    status: BookingStatus | undefined,
    page: number,
    limit: number,
  ) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      bookingsRepository.findMany({ riderId, status, skip, take: limit }),
      bookingsRepository.count({ riderId, status }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async listAll(status: BookingStatus | undefined, page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      bookingsRepository.findMany({ status, skip, take: limit }),
      bookingsRepository.count({ status }),
    ]);
    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async updateStatus(
    bookingId: string,
    newStatus: BookingStatus,
    note: string | undefined,
    requester: { id: string; role: Role },
  ) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isAssignedRider = booking.riderId === requester.id;
    const isStaff = requester.role === 'ADMIN';
    if (!isAssignedRider && !isStaff) {
      throw new ForbiddenError('Only the assigned rider or an admin can update this booking');
    }

    const allowedNext = ALLOWED_TRANSITIONS[booking.status];
    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestError(
        `Cannot transition from ${booking.status} to ${newStatus}. Allowed: ${allowedNext.join(', ') || 'none'}`,
      );
    }

    return bookingsRepository.updateStatus(bookingId, newStatus, note);
  },

  async assignRider(bookingId: string, riderId: string) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new BadRequestError('Can only assign a rider to a pending or confirmed booking');
    }

    // Closes gaps #7 and #8 — rejects non-existent, wrong-role, or deactivated users
    const rider = await bookingsRepository.findRiderById(riderId);
    if (!rider || rider.role !== 'RIDER' || !rider.isActive) {
      throw new BadRequestError('riderId does not correspond to an active rider');
    }

    await bookingsRepository.assignRider(bookingId, riderId);
    // Auto-confirm on rider assignment so the rider knows it's ready to pick up
    return bookingsRepository.updateStatus(bookingId, 'CONFIRMED', 'Rider assigned');
  },
};
