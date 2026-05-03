import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import * as paymentController from '../controllers/payment.controller.js';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import { createPaymentSchema, paymentQuerySchema } from '../validations/order.validation.js';
import { strictLimiter, webhookLimiter } from '../middleware/rateLimit.middleware.js';

const router = Router();

router.get('/methods', asyncHandler(paymentController.getPaymentMethods));
router.post('/create', isAuthenticated, strictLimiter, validateBody(createPaymentSchema), asyncHandler(paymentController.createPayment));
router.get('/history', isAuthenticated, validateQuery(paymentQuerySchema), asyncHandler(paymentController.getPaymentHistory));

router.post('/webhook/momo', webhookLimiter, asyncHandler(paymentController.momoWebhook));
router.get('/webhook/sepay', webhookLimiter, asyncHandler(paymentController.sepayReturn));
router.post('/webhook/sepay', webhookLimiter, asyncHandler(paymentController.sepayReturn));
router.post('/webhook/paypal', webhookLimiter, asyncHandler(paymentController.paypalWebhook));

export default router;
