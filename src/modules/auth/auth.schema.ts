import { z } from 'zod';
import { kenyanPhoneSchema } from '../../lib/phone.js';

// phone regex is scoped to Kenyan numbers (+254...); password.max(72) matches bcrypt's silent truncation boundary.
export const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: kenyanPhoneSchema,
    password: z.string().min(8).max(72),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type LoginInput = z.infer<typeof loginSchema>['body'];
