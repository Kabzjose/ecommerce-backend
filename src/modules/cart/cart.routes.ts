import { Router } from 'express';
import { cartController } from './cart.controller.js';
import { validate } from '../../middleware/validate.middleware.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/role.middleware.js';
import { addToCartSchema, updateCartItemSchema, removeCartItemSchema } from './cart.schema.js';

export const cartRouter = Router();

cartRouter.use(requireAuth, requireRole('CUSTOMER'));

cartRouter.get('/', asyncHandler(cartController.getCart));
cartRouter.post('/items', validate(addToCartSchema), asyncHandler(cartController.addItem));
cartRouter.patch('/items/:productId', validate(updateCartItemSchema), asyncHandler(cartController.updateItem));
cartRouter.delete('/items/:productId', validate(removeCartItemSchema), asyncHandler(cartController.removeItem));
cartRouter.delete('/', asyncHandler(cartController.clear));
