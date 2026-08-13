import { Router } from 'express';
import { z } from 'zod';
import { productsController } from './products.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware .js';
import { requireRole } from '../../middleware/role.middleware.js';
import { createProductSchema, updateProductSchema, listProductsQuerySchema } from './products.schema.js';

export const productsRouter = Router();

// ─── Public routes — no auth required ──────────────────────────────────────────
// Browsing the catalog must work without a login (for the storefront / guest users).
// req.user?.role === 'ADMIN' in the controller provides admin-specific behaviour for
// authenticated admins hitting these same endpoints.
productsRouter.get(
  '/',
  validate(listProductsQuerySchema),
  asyncHandler(productsController.list),
);

productsRouter.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(productsController.getOne),
);

// ─── Admin-only routes ─────────────────────────────────────────────────────────
productsRouter.post(
  '/',
  requireAuth,
  requireRole('ADMIN'),
  validate(createProductSchema),
  asyncHandler(productsController.create),
);

productsRouter.patch(
  '/:id',
  requireAuth,
  requireRole('ADMIN'),
  validate(updateProductSchema),
  asyncHandler(productsController.update),
);

productsRouter.patch(
  '/:id/deactivate',
  requireAuth,
  requireRole('ADMIN'),
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(productsController.deactivate),
);
