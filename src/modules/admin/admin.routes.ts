import { Router } from 'express';
import { z } from 'zod';
import { adminController } from './admin.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { revenueQuerySchema, riderPerformanceQuerySchema } from './admin.schema.js';

export const adminRouter = Router();

// All admin routes require authentication + ADMIN role
adminRouter.use(requireAuth, requireRole('ADMIN'));

adminRouter.get('/overview', asyncHandler(adminController.overview));

adminRouter.get(
  '/riders/performance',
  validate(riderPerformanceQuerySchema),
  asyncHandler(adminController.allRidersPerformance),
);

adminRouter.get(
  '/riders/:id/performance',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(adminController.singleRiderPerformance),
);

adminRouter.get('/revenue', validate(revenueQuerySchema), asyncHandler(adminController.revenue));
