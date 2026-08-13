import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(150),
    description: z.string().min(5).max(2000),
    price: z.coerce.number().positive(),
    stockQuantity: z.coerce.number().int().nonnegative(),
    imageUrl: z.string().url().optional(),
    category: z.string().min(2).max(50),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    name: z.string().min(2).max(150).optional(),
    description: z.string().min(5).max(2000).optional(),
    price: z.coerce.number().positive().optional(),
    stockQuantity: z.coerce.number().int().nonnegative().optional(),
    imageUrl: z.string().url().optional(),
    category: z.string().min(2).max(50).optional(),
    isActive: z.boolean().optional(),
  }),
});

export const listProductsQuerySchema = z.object({
  query: z.object({
    category: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
