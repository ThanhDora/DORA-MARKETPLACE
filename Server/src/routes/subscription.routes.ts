import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { createSubscriptionSchema, createPaymentConfigSchema, updatePaymentConfigSchema } from '../validations/order.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import * as subscriptionController from '../controllers/subscription.controller.js';

const router = Router();

router.get('/plans', asyncHandler(subscriptionController.getSubscriptionPlans));

router.use(isAuthenticated);

router.get('/my', asyncHandler(subscriptionController.getMySubscription));
router.post('/buy', requireMinRole('USER'), validateBody(createSubscriptionSchema), asyncHandler(subscriptionController.createSubscription));
router.get('/stats', requireMinRole('SELLER'), asyncHandler(subscriptionController.getSellerStats));

router.get('/payment-configs', requireMinRole('SELLER'), asyncHandler(subscriptionController.getPaymentConfigs));
router.post('/payment-configs', requireMinRole('SELLER'), validateBody(createPaymentConfigSchema), asyncHandler(subscriptionController.createPaymentConfig));
router.put('/payment-configs/:id', requireMinRole('SELLER'), validateBody(updatePaymentConfigSchema), asyncHandler(subscriptionController.updatePaymentConfig));
router.delete('/payment-configs/:id', requireMinRole('SELLER'), asyncHandler(subscriptionController.deletePaymentConfig));

export default router;
