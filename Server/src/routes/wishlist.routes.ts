import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { addToWishlistSchema } from '../validations/product.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import * as wishlistController from '../controllers/wishlist.controller.js';

const router = Router();

router.use(isAuthenticated);
router.get('/', asyncHandler(wishlistController.getWishlist));
router.post('/', validateBody(addToWishlistSchema), asyncHandler(wishlistController.addToWishlist));
router.get('/:productId/check', asyncHandler(wishlistController.checkWishlist));
router.delete('/:productId', asyncHandler(wishlistController.removeFromWishlist));

export default router;
