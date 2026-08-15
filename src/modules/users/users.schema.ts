import { z } from 'zod';
import { kenyanPhoneSchema } from '../../lib/phone.js';

export const createUserByAdminSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone: kenyanPhoneSchema,
    password: z.string().min(8).max(72),
    // CUSTOMER is intentionally excluded — that role is self-registration only via /api/auth/register
    role: z.enum(['RIDER', 'ADMIN']),
  }),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    role: z.enum(['CUSTOMER', 'RIDER', 'ADMIN', 'BUSINESS']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateUserByAdminInput = z.infer<typeof createUserByAdminSchema>['body'];
