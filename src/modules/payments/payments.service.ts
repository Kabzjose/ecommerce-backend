import { paymentsRepository } from './payments.repository.js';
import { bookingsRepository } from '../bookings/bookings.repository.js';
import { initiateStkPush } from '../../lib/mpesa.js';
import { initializeTransaction, verifyTransaction } from '../../lib/paystack.js';
import { logger } from '../../lib/logger.js';
import { BadRequestError, NotFoundError } from '../../lib/errors.js';

export const paymentsService = {
  async initiateMpesa(bookingId: string, phone: string, amount: number) {
    const payment = await paymentsRepository.create({
      bookingId,
      method: 'MPESA',
      amount,
      mpesaPhone: phone,
    });

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
      const result = await initializeTransaction({
        email,
        amountKes: amount,
        // Our own payment id becomes Paystack's reference — guarantees uniqueness, easy to look up
        reference: payment.id,
      });
      await paymentsRepository.setPaystackDetails(payment.id, {
        reference: result.reference,
        accessCode: result.accessCode,
        authUrl: result.authorizationUrl,
      });
      return {
        method: 'CARD' as const,
        paymentId: payment.id,
        authorizationUrl: result.authorizationUrl,
      };
    } catch (err) {
      await paymentsRepository.markResult(payment.id, 'FAILED', {
        failureReason: err instanceof Error ? err.message : 'Unknown error',
      });
      await bookingsRepository.updateStatus(bookingId, 'CANCELLED', 'Payment initiation failed');
      throw new BadRequestError('Could not initiate card payment. Please try again.');
    }
  },

  /**
   * Called by Safaricom's servers — this is the source of truth for M-Pesa payment outcome.
   * The initial initiateStkPush response only confirms Safaricom received the request;
   * this callback is the only place we learn if the customer actually approved it.
   */
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

    // Idempotency guard — Safaricom sometimes retries callbacks if we don't respond fast enough
    if (payment.status !== 'PENDING') {
      logger.info({ checkoutRequestId }, 'Callback for already-processed payment, ignoring');
      return;
    }

    if (resultCode === 0) {
      const items: Array<{ Name: string; Value: unknown }> =
        stkCallback.CallbackMetadata?.Item ?? [];
      const receipt = items.find((i) => i.Name === 'MpesaReceiptNumber')?.Value as
        | string
        | undefined;
      await paymentsRepository.markResult(payment.id, 'SUCCESS', { mpesaReceiptNumber: receipt });
      await bookingsRepository.updateStatus(payment.bookingId, 'PENDING', 'Payment confirmed');
      logger.info({ bookingId: payment.bookingId, receipt }, 'M-Pesa payment succeeded');
    } else {
      await paymentsRepository.markResult(payment.id, 'FAILED', { failureReason: resultDesc });
      await bookingsRepository.updateStatus(
        payment.bookingId,
        'CANCELLED',
        `Payment failed: ${resultDesc}`,
      );
      logger.info({ bookingId: payment.bookingId, resultDesc }, 'M-Pesa payment failed');
    }
  },

  /**
   * Called by Paystack's webhook. Signature must be verified by the controller before calling here.
   *
   * We re-verify the transaction directly with Paystack's API rather than trusting the webhook
   * payload alone — "belt and suspenders": signature check proves it came from Paystack,
   * re-verification proves the data is still accurate right now.
   */
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
    await bookingsRepository.updateStatus(payment.bookingId, 'PENDING', 'Payment confirmed');
    logger.info({ bookingId: payment.bookingId, reference }, 'Card payment succeeded');
  },

  async getStatus(bookingId: string) {
    const payment = await paymentsRepository.findByBookingId(bookingId);
    if (!payment) {
      throw new NotFoundError('No payment found for this booking');
    }
    return payment;
  },
};
