import { z } from 'zod';

export const addToCartSchema = z.object({
  body: z.object({
    productId: z.string().uuid(),
    quantity: z.coerce.number().int().positive().max(50),
  }),
});

export const updateCartItemSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
  body: z.object({
    quantity: z.coerce.number().int().positive().max(50),
  }),
});

export const removeCartItemSchema = z.object({
  params: z.object({ productId: z.string().uuid() }),
});

export type AddToCartInput = z.infer<typeof addToCartSchema>['body'];
