import { z } from 'zod';

export const checkoutSchema = z.object({
  body: z
    .object({
      recipientName: z.string().min(2).max(100),
      recipientPhone: z.string().regex(/^\+254\d{9}$/, 'Phone must be in format +254XXXXXXXXX'),
      dropoffZoneId: z.string().uuid(),
      dropoffAddress: z.string().min(5).max(255),
      paymentMethod: z.enum(['MPESA', 'CARD']),
      payerPhone: z.string().regex(/^\+254\d{9}$/).optional(),
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
