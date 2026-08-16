import { Router } from 'express';
import { checkoutController } from './checkout.controller.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';
import { checkoutSchema } from './checkout.schema.js';

export const checkoutRouter = Router();

checkoutRouter.post(
  '/',
  requireAuth,
  requireRole('CUSTOMER'),
  validate(checkoutSchema),
  asyncHandler(checkoutController.checkout),
);
