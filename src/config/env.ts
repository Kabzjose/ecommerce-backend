import { z } from 'zod';
import 'dotenv/config';

// Validates all required env vars at startup — exits immediately if anything is missing or malformed.
const envSchema = z.object({
  FRONTEND_URL: z.string().url('FRONTEND_URL must be a valid URL'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Leave undefined in development; set to your root domain (e.g. "chapchap.co.ke") in production.
  COOKIE_DOMAIN: z.string().optional(),
  // M-Pesa Daraja — optional at startup; throws at runtime if payment attempted without real values
  MPESA_CONSUMER_KEY: z.string().default(''),
  MPESA_CONSUMER_SECRET: z.string().default(''),
  MPESA_SHORTCODE: z.string().default('174379'),
  MPESA_PASSKEY: z.string().default(''),
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_CALLBACK_URL: z.string().default('https://placeholder.example.com/api/payments/mpesa/callback'),
  // Paystack — optional at startup; throws at runtime if card payment attempted without real values
  PAYSTACK_SECRET_KEY: z.string().default(''),
  PAYSTACK_PUBLIC_KEY: z.string().default(''),  
  PAYSTACK_CALLBACK_URL: z.string().default('https://placeholder.example.com/api/payments/paystack/callback'),
  // Africa's Talking SMS
  AT_USERNAME: z.string().default('sandbox'),
  AT_API_KEY: z.string().default(''),
  AT_SENDER_ID: z.string().optional(),
  // Store pickup location — used by checkout to set the booking pickup point
  // Get zone ID from: pnpm prisma studio → zones table → copy the row id
  STORE_PICKUP_ZONE_ID: z.string().uuid().default('00000000-0000-0000-0000-000000000000'),
  STORE_PICKUP_ADDRESS: z.string().default('ChapChap Warehouse, Enterprise Road, Industrial Area'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
