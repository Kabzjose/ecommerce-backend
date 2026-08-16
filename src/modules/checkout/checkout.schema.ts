import { z } from 'zod';
import { kenyanPhoneSchema } from '../../lib/phone.js';

export const checkoutSchema = z.object({
  body: z
    .object({
      recipientName: z.string().min(2).max(100),
      recipientPhone: kenyanPhoneSchema,
      dropoffZoneId: z.string().uuid(),
      dropoffAddress: z.string().min(5).max(255),
      paymentMethod: z.enum(['MPESA', 'CARD']),
      payerPhone: kenyanPhoneSchema.optional(),
      payerEmail: z.string().email().optional(),
    })
    .refine((d) => d.paymentMethod !== 'MPESA' || !!d.payerPhone, {
      message: 'payerPhone is required for MPESA',
      path: ['payerPhone'],
    })
    .refine((d) => d.paymentMethod !== 'CARD' || !!d.payerEmail, {
      message: 'payerEmail is required for CARD',
      path: ['payerEmail'],
    }),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>['body'];
