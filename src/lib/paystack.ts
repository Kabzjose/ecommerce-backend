import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const BASE_URL = 'https://api.paystack.co';

export interface InitializeTransactionResult {
  authorizationUrl: string;
  accessCode: string;
  reference: string;
}

export async function initializeTransaction(params: {
  email: string;
  amountKes: number;
  reference: string;
}): Promise<InitializeTransactionResult> {
  const res = await fetch(`${BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      // Paystack expects the smallest currency unit — kobo for NGN, cents for KES
      // Sending 300 without this multiplication would charge KES 3 — a costly bug
      amount: Math.round(params.amountKes * 100),
      currency: 'KES',
      reference: params.reference,
      callback_url: env.PAYSTACK_CALLBACK_URL,
    }),
  });

  const data = (await res.json()) as any;

  if (!res.ok || !data.status) {
    logger.error({ data }, 'Paystack initialize transaction failed');
    throw new Error(data.message ?? 'Failed to initialize card payment');
  }

  return {
    authorizationUrl: data.data.authorization_url,
    accessCode: data.data.access_code,
    reference: data.data.reference,
  };
}

export async function verifyTransaction(reference: string) {
  const res = await fetch(`${BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` },
  });

  const data = (await res.json()) as any;

  if (!res.ok || !data.status) {
    logger.error({ data }, 'Paystack verify transaction failed');
    throw new Error(data.message ?? 'Failed to verify transaction');
  }

  return data.data as { status: string; reference: string; amount: number };
}

/**
 * HMAC-SHA512 signature check — the only thing preventing someone from
 * calling our webhook URL directly and faking a "payment succeeded" event.
 * Paystack signs every payload with your secret key; we recompute and compare.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
): boolean {
  if (!signatureHeader) return false;
  const hash = crypto
    .createHmac('sha512', env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === signatureHeader;
}
