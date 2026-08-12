import { prisma } from '../../config/db.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(): Date {
  const d = startOfToday();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d;
}

export const adminRepository = {
  async getOverviewStats() {
    const [
      totalBookings,
      totalRevenue,
      activeRiders,
      bookingsToday,
      bookingsThisWeek,
      bookingsByStatus,
      deliveredCount,
      cancelledCount,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amount: true } }),
      prisma.user.count({ where: { role: 'RIDER', isActive: true } }),
      prisma.booking.count({ where: { createdAt: { gte: startOfToday() } } }),
      prisma.booking.count({ where: { createdAt: { gte: startOfWeek() } } }),
      prisma.booking.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.booking.count({ where: { status: 'DELIVERED' } }),
      prisma.booking.count({ where: { status: 'CANCELLED' } }),
    ]);

    return {
      totalBookings,
      totalRevenue: totalRevenue._sum.amount ?? 0,
      activeRiders,
      bookingsToday,
      bookingsThisWeek,
      deliveredCount,
      cancelledCount,
      bookingsByStatus: bookingsByStatus.map((b) => ({
        status: b.status,
        count: b._count._all,
      })),
    };
  },

  async getRiderPerformance(riderId: string) {
    const [totalAssigned, delivered, cancelled, bookings] = await Promise.all([
      prisma.booking.count({ where: { riderId } }),
      prisma.booking.count({ where: { riderId, status: 'DELIVERED' } }),
      prisma.booking.count({ where: { riderId, status: 'CANCELLED' } }),
      // Only delivered bookings have a complete lifecycle to time
      prisma.booking.findMany({
        where: { riderId, status: 'DELIVERED' },
        include: { statusHistory: { orderBy: { changedAt: 'asc' } } },
      }),
    ]);

    const deliveryTimesMs = bookings
      .map((b) => {
        const pickedUp = b.statusHistory.find((h) => h.status === 'PICKED_UP')?.changedAt;
        const deliveredAt = b.statusHistory.find((h) => h.status === 'DELIVERED')?.changedAt;
        if (!pickedUp || !deliveredAt) return null;
        return deliveredAt.getTime() - pickedUp.getTime();
      })
      .filter((t): t is number => t !== null);

    const avgDeliveryTimeMinutes =
      deliveryTimesMs.length > 0
        ? Math.round(
            deliveryTimesMs.reduce((sum, t) => sum + t, 0) / deliveryTimesMs.length / 60000,
          )
        : null;

    return {
      totalAssigned,
      delivered,
      cancelled,
      cancellationRate: totalAssigned > 0 ? Math.round((cancelled / totalAssigned) * 100) : 0,
      avgDeliveryTimeMinutes,
    };
  },

  async listRidersForPerformance(skip: number, take: number) {
    const [riders, total] = await Promise.all([
      prisma.user.findMany({
        where: { role: 'RIDER' },
        select: { id: true, name: true, phone: true, isActive: true },
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      prisma.user.count({ where: { role: 'RIDER' } }),
    ]);
    return { riders, total };
  },

  async getRevenueByPeriod(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Raw SQL for date-bucketed aggregation — Prisma's query builder can't GROUP BY day natively
    const rows = await prisma.$queryRaw<{ day: Date; total: number }[]>`
      SELECT DATE("createdAt") as day, SUM(amount)::float as total
      FROM payments
      WHERE status = 'SUCCESS' AND "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY day ASC
    `;

    return rows.map((r) => ({ date: r.day, revenue: r.total }));
  },
};
