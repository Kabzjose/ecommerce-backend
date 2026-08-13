import { Router } from 'express';
import { z } from 'zod';
import { ordersController } from './orders.controller.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware .js';
import { requireRole } from '../../middleware/role.middleware.js';
import { validate } from '../../middleware/validate.middleware.js';

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole('CUSTOMER'));

ordersRouter.get('/', asyncHandler(ordersController.listMine));

ordersRouter.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(ordersController.getOne),
);
