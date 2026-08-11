import { sendSms } from '../../lib/sms.js';
import { notificationsRepository } from './notifications.repository.js';
import { logger } from '../../lib/logger.js';

export const notificationsService = {
  /**
   * Fire-and-log: sends SMS, records the outcome, NEVER throws to the caller.
   * SMS failures are logged and tracked but must not affect booking/payment correctness.
   */
  async notify(params: {
    phone: string;
    message: string;
    bookingId?: string;
    userId?: string;
  }) {
    const result = await sendSms(params.phone, params.message);

    await notificationsRepository.log({
      bookingId: params.bookingId,
      userId: params.userId,
      recipient: params.phone,
      message: params.message,
      status: result.success ? 'SENT' : 'FAILED',
      errorMsg: result.errorMessage,
    });

    if (!result.success) {
      logger.warn(
        { phone: params.phone, bookingId: params.bookingId },
        'Notification failed, continuing anyway',
      );
    }
  },

  getHistoryForBooking(bookingId: string) {
    return notificationsRepository.listForBooking(bookingId);
  },
};
