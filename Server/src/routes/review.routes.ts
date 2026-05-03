import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { createReviewSchema } from '../validations/product.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import * as reviewController from '../controllers/review.controller.js';

const router = Router();

router.get('/product/:productId', asyncHandler(reviewController.listProductReviews));
router.post('/', isAuthenticated, validateBody(createReviewSchema), asyncHandler(reviewController.createReview));
router.put('/:id', isAuthenticated, asyncHandler(reviewController.updateReview));
router.delete('/:id', isAuthenticated, asyncHandler(reviewController.deleteReview));

export default router;
