import { Router } from 'express';
import { z } from 'zod';
import { usersController } from './users.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { createUserByAdminSchema, listUsersQuerySchema } from './users.schema.js';

export const usersRouter = Router();

// Lock down the entire module in one line — every route here requires a valid token + ADMIN role
usersRouter.use(requireAuth, requireRole('ADMIN'));

usersRouter.post('/', validate(createUserByAdminSchema), asyncHandler(usersController.create));

usersRouter.get('/', validate(listUsersQuerySchema), asyncHandler(usersController.list));

usersRouter.patch(
  '/:id/deactivate',
  validate(z.object({ params: z.object({ id: z.string().uuid() }) })),
  asyncHandler(usersController.deactivate),
);
