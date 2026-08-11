import { bookingsRepository } from './bookings.repository.js';
import { pricingService } from '../pricing/pricing.service.js';
import { paymentsService } from '../payments/payments.service.js';
import { usersRepository } from '../users/users.repository.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { templates } from '../notifications/templates.js';
import { BadRequestError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import type { CreateBookingInput } from './bookings.schema.js';
import type { BookingStatus, Role } from '@prisma/client';

// State machine — single source of truth for legal lifecycle transitions.
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
    const quote = await pricingService.calculateQuote({
      pickupZoneId: input.pickupZoneId,
      dropoffZoneId: input.dropoffZoneId,
      packageType: input.packageType,
      weightKg: input.weightKg,
    });

    // Explicit field list — payerPhone/payerEmail are input-only; must not reach the Booking model
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

    // Branch on payment method — Zod .refine() guarantees the right field is present
    const payment =
      input.paymentMethod === 'MPESA'
        ? await paymentsService.initiateMpesa(booking.id, input.payerPhone!, quote.price)
        : await paymentsService.initiateCard(booking.id, input.payerEmail!, quote.price);

    return { booking, payment };
  },

  async getById(bookingId: string, requester: { id: string; role: Role }) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

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
    if (!booking) throw new NotFoundError('Booking not found');

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

    const updated = await bookingsRepository.updateStatus(bookingId, newStatus, note);

    // SMS fires AFTER the DB write — provider outage can't roll back a valid status change
    const customer = await usersRepository.findById(booking.customerId);
    const messageMap: Partial<Record<BookingStatus, string>> = {
      PICKED_UP: templates.pickedUp(booking.id),
      IN_TRANSIT: templates.inTransit(booking.id),
      DELIVERED: templates.delivered(booking.id),
      CANCELLED: templates.bookingCancelled(booking.id, note ?? 'Cancelled'),
    };
    const message = messageMap[newStatus];
    if (message && customer) {
      await notificationsService.notify({
        phone: customer.phone,
        message,
        bookingId: booking.id,
        userId: customer.id,
      });
    }

    return updated;
  },

  async assignRider(bookingId: string, riderId: string) {
    const booking = await bookingsRepository.findById(bookingId);
    if (!booking) throw new NotFoundError('Booking not found');

    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new BadRequestError('Can only assign a rider to a pending or confirmed booking');
    }

    // Closes gaps #7 and #8 — rejects non-existent, wrong-role, or deactivated users
    const rider = await bookingsRepository.findRiderById(riderId);
    if (!rider || rider.role !== 'RIDER' || !rider.isActive) {
      throw new BadRequestError('riderId does not correspond to an active rider');
    }

    await bookingsRepository.assignRider(bookingId, riderId);
    const updated = await bookingsRepository.updateStatus(bookingId, 'CONFIRMED', 'Rider assigned');

    // Notify the customer that their rider is confirmed
    const [customer, riderFull] = await Promise.all([
      usersRepository.findById(booking.customerId),
      usersRepository.findById(riderId),
    ]);
    if (customer && riderFull) {
      await notificationsService.notify({
        phone: customer.phone,
        message: templates.riderAssigned(booking.id, riderFull.name),
        bookingId: booking.id,
        userId: customer.id,
      });
    }

    return updated;
  },
};
