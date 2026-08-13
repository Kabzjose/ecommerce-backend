import { prisma } from '../../config/db.js';

export const ordersRepository = {
  /**
   * Creates order + items + decrements stock atomically.
   * If ANY product has insufficient stock, the entire transaction rolls back.
   * The atomic updateMany pattern prevents overselling under concurrent checkouts.
   */
  async createWithItemsAndReserveStock(data: {
    customerId: string;
    items: { productId: string; quantity: number; unitPrice: number }[];
    productsTotal: number;
    deliveryFee: number;
    totalAmount: number;
    recipientName: string;
    recipientPhone: string;
    dropoffZoneId: string;
    dropoffAddress: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          customerId: data.customerId,
          productsTotal: data.productsTotal,
          deliveryFee: data.deliveryFee,
          totalAmount: data.totalAmount,
          recipientName: data.recipientName,
          recipientPhone: data.recipientPhone,
          dropoffZoneId: data.dropoffZoneId,
          dropoffAddress: data.dropoffAddress,
          status: 'AWAITING_PAYMENT',
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      for (const item of data.items) {
        // Atomic check-and-decrement — prevents race condition between read and write
        const result = await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { gte: item.quantity } },
          data: { stockQuantity: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          // Throws inside transaction → entire tx rolls back (order + all decrements so far)
          throw new Error(`INSUFFICIENT_STOCK:${item.productId}`);
        }
      }

      return order;
    });
  },

  findById(id: string) {
    return prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, booking: true, dropoffZone: true },
    });
  },

  findByIdForUser(id: string, customerId: string) {
    return prisma.order.findFirst({
      where: { id, customerId },
      include: { items: { include: { product: true } }, booking: true },
    });
  },

  listForCustomer(customerId: string, skip: number, take: number) {
    return prisma.order.findMany({
      where: { customerId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  },

  countForCustomer(customerId: string) {
    return prisma.order.count({ where: { customerId } });
  },

  markPaidAndLinkBooking(orderId: string, bookingId: string) {
    return prisma.order.update({
      where: { id: orderId },
      data: { status: 'PAID', bookingId },
    });
  },

  /**
   * Mirror of createWithItemsAndReserveStock — restores stock if payment fails.
   * Also runs in a transaction so stock is always fully restored or not at all.
   */
  async cancelAndRestoreStock(orderId: string) {
    return prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });
      if (!order) return null;

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      return tx.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
    });
  },
};
