import { paymentsRepository } from './payments.repository.js';
import { bookingsRepository } from '../bookings/bookings.repository.js';
import { ordersRepository } from '../orders/orders.repository.js';
import { initiateStkPush } from '../../lib/mpesa.js';
import { initializeTransaction, verifyTransaction } from '../../lib/paystack.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { templates } from '../notifications/templates.js';
import { logger } from '../../lib/logger.js';
import { env } from '../../config/env.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

// ─── Private helper ────────────────────────────────────────────────────────────
// Called after payment succeeds for an ORDER — creates the delivery booking and
// links it back to the order. This is where the order→booking bridge happens.
async function handleOrderPaymentSuccess(orderId: string) {
  const order = await ordersRepository.findById(orderId);
  if (!order) {
    logger.error({ orderId }, 'Paid order not found — cannot create booking');
    return;
  }

  // Booking starts at PENDING (not AWAITING_PAYMENT) because payment is already confirmed
  const booking = await bookingsRepository.createAtStatus('PENDING', {
    customerId: order.customerId,
    recipientName: order.recipientName,
    recipientPhone: order.recipientPhone,
    pickupZoneId: env.STORE_PICKUP_ZONE_ID,
    pickupAddress: env.STORE_PICKUP_ADDRESS,
    dropoffZoneId: order.dropoffZoneId,
    dropoffAddress: order.dropoffAddress,
    packageType: 'PARCEL',
    weightKg: 2,
    price: order.deliveryFee,
  });

  await ordersRepository.markPaidAndLinkBooking(order.id, booking.id);

  await notificationsService.notify({
    phone: order.recipientPhone,
    message: `ChapChap: Order confirmed! Your items are being prepared for delivery. Booking ref: #${booking.id.slice(0, 8)}.`,
    bookingId: booking.id,
  });

  logger.info({ orderId, bookingId: booking.id }, 'Order payment succeeded — booking created');
}

// ──────────────────────────────────────────────────────────────────────────────

export const paymentsService = {
  // ─── Booking-linked payments (direct delivery bookings) ────────────────────

  async initiateMpesa(bookingId: string, phone: string, amount: number) {
    const payment = await paymentsRepository.create({ bookingId, method: 'MPESA', amount, mpesaPhone: phone });
    try {
      const stkResult = await initiateStkPush({
        phone,
        amount,
        accountReference: `CHAPCHAP-${bookingId.slice(0, 8)}`,
        transactionDesc: 'Delivery payment',
      });
      await paymentsRepository.setStkDetails(payment.id, {
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
      });
      return { method: 'MPESA' as const, paymentId: payment.id, message: stkResult.customerMessage };
    } catch (err) {
      await paymentsRepository.markResult(payment.id, 'FAILED', {
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
      await bookingsRepository.updateStatus(bookingId, 'CANCELLED', 'Payment initiation failed');
      throw new BadRequestError('Could not initiate M-Pesa payment. Please try again.');
    }
  },

  async initiateCard(bookingId: string, email: string, amount: number) {
    const payment = await paymentsRepository.create({ bookingId, method: 'CARD', amount });
    try {
      const result = await initializeTransaction({ email, amountKes: amount, reference: payment.id });
      await paymentsRepository.setPaystackDetails(payment.id, {
        reference: result.reference,
        accessCode: result.accessCode,
        authUrl: result.authorizationUrl,
      });
      return { method: 'CARD' as const, paymentId: payment.id, authorizationUrl: result.authorizationUrl };
    } catch (err) {
      await paymentsRepository.markResult(payment.id, 'FAILED', {
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
      await bookingsRepository.updateStatus(bookingId, 'CANCELLED', 'Payment initiation failed');
      throw new BadRequestError('Could not initiate card payment. Please try again.');
    }
  },

  // ─── Order-linked payments (checkout flow) ─────────────────────────────────

  async initiateMpesaForOrder(orderId: string, phone: string, amount: number) {
    const payment = await paymentsRepository.createForOrder({ orderId, method: 'MPESA', amount, mpesaPhone: phone });
    try {
      const stkResult = await initiateStkPush({
        phone,
        amount,
        accountReference: `CHAPCHAP-ORD-${orderId.slice(0, 8)}`,
        transactionDesc: 'Order payment',
      });
      await paymentsRepository.setStkDetails(payment.id, {
        checkoutRequestId: stkResult.checkoutRequestId,
        merchantRequestId: stkResult.merchantRequestId,
      });
      return { method: 'MPESA' as const, paymentId: payment.id, message: stkResult.customerMessage };
    } catch (err) {
      await paymentsRepository.markResult(payment.id, 'FAILED', {
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
      await ordersRepository.cancelAndRestoreStock(orderId);
      throw new BadRequestError('Could not initiate M-Pesa payment. Please try again.');
    }
  },

  async initiateCardForOrder(orderId: string, email: string, amount: number) {
    const payment = await paymentsRepository.createForOrder({ orderId, method: 'CARD', amount });
    try {
      const result = await initializeTransaction({ email, amountKes: amount, reference: payment.id });
      await paymentsRepository.setPaystackDetails(payment.id, {
        reference: result.reference,
        accessCode: result.accessCode,
        authUrl: result.authorizationUrl,
      });
      return { method: 'CARD' as const, paymentId: payment.id, authorizationUrl: result.authorizationUrl };
    } catch (err) {
      await paymentsRepository.markResult(payment.id, 'FAILED', {
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
      await ordersRepository.cancelAndRestoreStock(orderId);
      throw new BadRequestError('Could not initiate card payment. Please try again.');
    }
  },

  // ─── Webhook handlers ──────────────────────────────────────────────────────

  async handleMpesaCallback(body: unknown) {
    const stkCallback = (body as any)?.Body?.stkCallback;
    if (!stkCallback) {
      logger.warn({ body }, 'Received malformed M-Pesa callback');
      return;
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID as string;
    const resultCode = stkCallback.ResultCode as number;
    const resultDesc = stkCallback.ResultDesc as string;

    const payment = await paymentsRepository.findByCheckoutRequestId(checkoutRequestId);
    if (!payment) {
      logger.warn({ checkoutRequestId }, 'Callback received for unknown payment');
      return;
    }
    if (payment.status !== 'PENDING') {
      logger.info({ checkoutRequestId }, 'Callback for already-processed payment, ignoring');
      return;
    }

    if (resultCode === 0) {
      const items: Array<{ Name: string; Value: unknown }> = stkCallback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as string | undefined;

      await paymentsRepository.markResult(payment.id, 'SUCCESS', { mpesaReceiptNumber: receipt });

      if (payment.orderId) {
        // Order-based payment — create the booking automatically
        await handleOrderPaymentSuccess(payment.orderId);
      } else if (payment.bookingId) {
        // Direct booking payment
        const booking = await bookingsRepository.updateStatus(payment.bookingId, 'PENDING', 'Payment confirmed');
        await notificationsService.notify({
          phone: payment.mpesaPhone!,
          message: templates.paymentConfirmed(booking.id, payment.amount),
          bookingId: booking.id,
        });
        logger.info({ bookingId: payment.bookingId, receipt }, 'M-Pesa booking payment succeeded');
      }
    } else {
      await paymentsRepository.markResult(payment.id, 'FAILED', { failureReason: resultDesc });

      if (payment.orderId) {
        await ordersRepository.cancelAndRestoreStock(payment.orderId);
        logger.info({ orderId: payment.orderId, resultDesc }, 'M-Pesa order payment failed — stock restored');
      } else if (payment.bookingId) {
        const booking = await bookingsRepository.updateStatus(
          payment.bookingId,
          'CANCELLED',
          `Payment failed: ${resultDesc}`,
        );
        await notificationsService.notify({
          phone: payment.mpesaPhone!,
          message: templates.bookingCancelled(booking.id, 'Payment failed'),
          bookingId: booking.id,
        });
        logger.info({ bookingId: payment.bookingId, resultDesc }, 'M-Pesa booking payment failed');
      }
    }
  },

  async handlePaystackWebhook(event: unknown) {
    const evt = event as any;
    if (evt.event !== 'charge.success') {
      logger.info({ event: evt.event }, 'Ignoring non-success Paystack event');
      return;
    }

    const reference = evt.data.reference as string;
    const verified = await verifyTransaction(reference);
    if (verified.status !== 'success') {
      logger.warn({ reference }, 'Webhook claimed success but verify call disagreed');
      return;
    }

    const payment = await paymentsRepository.findByPaystackReference(reference);
    if (!payment) {
      logger.warn({ reference }, 'Webhook for unknown payment reference');
      return;
    }
    if (payment.status !== 'PENDING') {
      logger.info({ reference }, 'Webhook for already-processed payment, ignoring');
      return;
    }

    await paymentsRepository.markResult(payment.id, 'SUCCESS', {});

    if (payment.orderId) {
      await handleOrderPaymentSuccess(payment.orderId);
    } else if (payment.bookingId) {
      const booking = await bookingsRepository.updateStatus(payment.bookingId, 'PENDING', 'Payment confirmed');
      await notificationsService.notify({
        phone: booking.recipientPhone,
        message: templates.paymentConfirmed(booking.id, payment.amount),
        bookingId: booking.id,
      });
      logger.info({ bookingId: payment.bookingId, reference }, 'Card booking payment succeeded');
    }
  },
  async getStatusByReference(reference: string) {
  const payment = await paymentsRepository.findByPaystackReferenceWithOrder(reference);
  if (!payment || !payment.order) {
    throw new NotFoundError('Payment not found');
  }
  return { orderId: payment.order.id, status: payment.order.status };
},

  async getStatus(bookingId: string) {
    const payment = await paymentsRepository.findByBookingId(bookingId);
    if (!payment) throw new NotFoundError('No payment found for this booking');
    return payment;
  },
};
