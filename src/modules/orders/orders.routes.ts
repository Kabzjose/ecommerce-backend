import { Router } from 'express';
import { ordersController } from './orders.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { listOrdersQuerySchema } from './orders.schema.js';
import { z } from 'zod';

export const ordersRouter = Router();

ordersRouter.use(requireAuth, requireRole('CUSTOMER'));

ordersRouter.get('/', validate(listOrdersQuerySchema), asyncHandler(ordersController.listMine));
ordersRouter.get(
  '/:id',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(ordersController.getOne)
);