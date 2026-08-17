import { Router } from 'express';
import { usersController } from './users.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { createUserByAdminSchema, listUsersQuerySchema } from './users.schema.js';
import { z } from 'zod';

export const usersRouter = Router();

usersRouter.use(requireAuth, requireRole('ADMIN'));

usersRouter.post('/', validate(createUserByAdminSchema), asyncHandler(usersController.create));
usersRouter.get('/', validate(listUsersQuerySchema), asyncHandler(usersController.list));
usersRouter.patch(
  '/:id/deactivate',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(usersController.deactivate)
);
