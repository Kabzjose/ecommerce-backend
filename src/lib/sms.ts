import { env } from '../config/env.js';
import { logger } from './logger.js';

const BASE_URL =
  env.AT_USERNAME === 'sandbox'
    ? 'https://api.sandbox.africastalking.com/version1/messaging'
    : 'https://api.africastalking.com/version1/messaging';

// Normalizes to +254XXXXXXXXX — the format Africa's Talking expects
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  if (phone.startsWith('+254')) return phone;
  throw new Error(`Cannot normalize phone number: ${phone}`);
}

/**
 * Sends an SMS via Africa's Talking.
 *
 * NEVER throws — always returns { success, errorMessage? }.
 * A failed SMS must never crash or roll back the business operation that triggered it.
 * The caller decides what to do with a failure (usually: log and move on).
 */
export async function sendSms(
  phone: string,
  message: string,
): Promise<{ success: boolean; errorMessage?: string }> {
  const recipient = normalizePhone(phone);

  const body = new URLSearchParams({
    username: env.AT_USERNAME,
    to: recipient,
    message,
    ...(env.AT_SENDER_ID && { from: env.AT_SENDER_ID }),
  });

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        apiKey: env.AT_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    const data = (await res.json()) as any;
    const recipientResult = data?.SMSMessageData?.Recipients?.[0];

    if (!res.ok || !recipientResult || recipientResult.status !== 'Success') {
      const errorMessage =
        recipientResult?.status ??
        data?.SMSMessageData?.Message ??
        'Unknown SMS error';
      logger.warn({ phone: recipient, errorMessage }, 'SMS send failed');
      return { success: false, errorMessage };
    }

    logger.info({ phone: recipient }, 'SMS sent successfully');
    return { success: true };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ phone: recipient, errorMessage }, 'SMS send threw an exception');
    return { success: false, errorMessage };
  }
}
