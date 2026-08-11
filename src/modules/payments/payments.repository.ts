import { prisma } from '../../config/db.js';
import type { PaymentStatus } from '@prisma/client';

export const paymentsRepository = {
  create(data: {
    bookingId: string;
    method: 'MPESA' | 'CARD' | 'BANK';
    amount: number;
    mpesaPhone?: string;
  }) {
    return prisma.payment.create({ data: { ...data, status: 'PENDING' } });
  },

  setStkDetails(paymentId: string, data: { checkoutRequestId: string; merchantRequestId: string }) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        mpesaCheckoutRequestId: data.checkoutRequestId,
        mpesaMerchantRequestId: data.merchantRequestId,
      },
    });
  },

  findByCheckoutRequestId(checkoutRequestId: string) {
    return prisma.payment.findUnique({
      where: { mpesaCheckoutRequestId: checkoutRequestId },
      include: { booking: true },
    });
  },

  findByBookingId(bookingId: string) {
    return prisma.payment.findUnique({ where: { bookingId } });
  },

  markResult(
    id: string,
    status: PaymentStatus,
    data: { mpesaReceiptNumber?: string; failureReason?: string },
  ) {
    return prisma.payment.update({
      where: { id },
      data: { status, ...data },
    });
  },

  setPaystackDetails(
    paymentId: string,
    data: { reference: string; accessCode: string; authUrl: string },
  ) {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        paystackReference: data.reference,
        paystackAccessCode: data.accessCode,
        paystackAuthUrl: data.authUrl,
      },
    });
  },

  findByPaystackReference(reference: string) {
    return prisma.payment.findUnique({
      where: { paystackReference: reference },
      include: { booking: true },
    });
  },
};
