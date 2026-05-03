import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import * as productController from '../controllers/product.controller.js';
import * as userController from '../controllers/user.controller.js';
import * as subscriptionController from '../controllers/subscription.controller.js';
import * as payoutController from '../controllers/payout.controller.js';

const router = Router();

router.use(isAuthenticated);
router.use(requireMinRole('SELLER'));

// Dashboard & Stats
router.get('/stats', asyncHandler(subscriptionController.getSellerStats));

// Product Management
router.get('/products', asyncHandler(productController.listSellerProducts));

// Order Management
router.get('/orders', asyncHandler(userController.getSellerOrders));

// Payout Management
router.get('/payouts', asyncHandler(payoutController.getMyPayouts));
router.get('/payouts/summary', asyncHandler(payoutController.getEarningsSummary));

// Payment Configuration
router.get('/payment-configs', asyncHandler(subscriptionController.getPaymentConfigs));

export default router;
