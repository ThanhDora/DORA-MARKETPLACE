import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { addToCartSchema, updateCartItemSchema } from '../validations/product.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import * as cartController from '../controllers/cart.controller.js';

const router = Router();

router.use(isAuthenticated);
router.get('/', asyncHandler(cartController.getCart));
router.post('/items', validateBody(addToCartSchema), asyncHandler(cartController.addToCart));
router.put('/items/:id', validateBody(updateCartItemSchema), asyncHandler(cartController.updateCartItem));
router.delete('/items/:id', asyncHandler(cartController.removeFromCart));
router.delete('/', asyncHandler(cartController.clearCart));

export default router;
