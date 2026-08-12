import { Router } from 'express';
import { authController } from './auth.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { registerSchema, loginSchema } from './auth.schema.js';
import { requireAuth } from '../../middleware/auth.middleware .js';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), asyncHandler(authController.register));
authRouter.post('/login', validate(loginSchema), asyncHandler(authController.login));
authRouter.post('/refresh', asyncHandler(authController.refresh));
authRouter.post('/logout', asyncHandler(authController.logout));
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
