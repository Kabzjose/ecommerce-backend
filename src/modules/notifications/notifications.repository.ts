import { prisma } from '../../config/db.js';
import type { NotificationStatus } from '@prisma/client';

export const notificationsRepository = {
  log(data: {
    bookingId?: string;
    userId?: string;
    recipient: string;
    message: string;
    status: NotificationStatus;
    errorMsg?: string;
  }) {
    return prisma.notificationLog.create({ data: { ...data, channel: 'SMS' } });
  },

  listForBooking(bookingId: string) {
    return prisma.notificationLog.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
    });
  },
};
