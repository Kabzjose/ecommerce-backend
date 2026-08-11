import { z } from 'zod';
import 'dotenv/config';

// Validates all required env vars at startup — exits immediately if anything is missing or malformed.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection string'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  // Leave undefined in development; set to your root domain (e.g. "chapchap.co.ke") in production.
  COOKIE_DOMAIN: z.string().optional(),
  // M-Pesa Daraja
  MPESA_CONSUMER_KEY: z.string(),
  MPESA_CONSUMER_SECRET: z.string(),
  MPESA_SHORTCODE: z.string(),
  MPESA_PASSKEY: z.string(),
  MPESA_ENV: z.enum(['sandbox', 'production']).default('sandbox'),
  MPESA_CALLBACK_URL: z.string().url(),

  // Paystack
  PAYSTACK_SECRET_KEY: z.string(),
  PAYSTACK_PUBLIC_KEY: z.string(),
  PAYSTACK_CALLBACK_URL: z.string().url(),

});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌  Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
