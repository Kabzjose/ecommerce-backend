import { z } from 'zod';

export const revenueQuerySchema = z.object({
  query: z.object({
    period: z.enum(['daily', 'weekly', 'monthly']).default('daily'),
    days: z.coerce.number().int().positive().max(365).default(30),
  }),
});

export const riderPerformanceQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }),
});
