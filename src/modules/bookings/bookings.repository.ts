import { prisma } from '../../config/db.js';
import type { BookingStatus, PackageType } from '@prisma/client';

export const bookingsRepository = {
  create(data: {
    customerId: string;
    recipientName: string;
    recipientPhone: string;
    pickupZoneId: string;
    pickupAddress: string;
    dropoffZoneId: string;
    dropoffAddress: string;
    packageType: PackageType;
    weightKg: number;
    specialInstructions?: string;
    price: number;
  }) {
    return prisma.booking.create({
      data: {
        ...data,
        status: 'AWAITING_PAYMENT',
        statusHistory: { create: { status: 'AWAITING_PAYMENT' } },
      },
      include: { pickupZone: true, dropoffZone: true },
    });
  },

  // Used by checkout flow — booking already has payment confirmed at order level
  // so it skips AWAITING_PAYMENT and starts at the caller-specified status.
  createAtStatus(
    status: BookingStatus,
    data: {
      customerId: string;
      recipientName: string;
      recipientPhone: string;
      pickupZoneId: string;
      pickupAddress: string;
      dropoffZoneId: string;
      dropoffAddress: string;
      packageType: PackageType;
      weightKg: number;
      price: number;
    },
  ) {
    return prisma.booking.create({
      data: { ...data, status, statusHistory: { create: { status } } },
      include: { pickupZone: true, dropoffZone: true },
    });
  },

  findById(id: string) {
    return prisma.booking.findUnique({
      where: { id },
      include: {
        pickupZone: true,
        dropoffZone: true,
        rider: { select: { id: true, name: true, phone: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
  },

  findMany(params: {
    customerId?: string;
    riderId?: string;
    status?: BookingStatus;
    skip: number;
    take: number;
  }) {
    const { customerId, riderId, status, skip, take } = params;
    return prisma.booking.findMany({
      where: {
        ...(customerId && { customerId }),
        ...(riderId && { riderId }),
        ...(status && { status }),
      },
      include: { pickupZone: true, dropoffZone: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  count(params: { customerId?: string; riderId?: string; status?: BookingStatus }) {
    const { customerId, riderId, status } = params;
    return prisma.booking.count({
      where: {
        ...(customerId && { customerId }),
        ...(riderId && { riderId }),
        ...(status && { status }),
      },
    });
  },

  updateStatus(id: string, status: BookingStatus, note?: string) {
    return prisma.booking.update({
      where: { id },
      data: {
        status,
        // Same atomic nested-write pattern — status + history always stay in sync
        statusHistory: {
          create: { status, note },
        },
      },
      include: {
        pickupZone: true,
        dropoffZone: true,
        rider: { select: { id: true, name: true, phone: true } },
        statusHistory: { orderBy: { changedAt: 'asc' } },
      },
    });
  },

  assignRider(id: string, riderId: string) {
    return prisma.booking.update({
      where: { id },
      data: { riderId },
    });
  },

  // Used to validate riderId before assignment — confirms user exists, is a RIDER, and is active
  findRiderById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
  },
};

