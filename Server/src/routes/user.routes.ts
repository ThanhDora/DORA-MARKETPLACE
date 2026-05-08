import { Router } from 'express';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import { updateProfileSchema } from '../validations/product.validation.js';
import { notificationIdParamSchema, notificationQuerySchema, userOrderQuerySchema } from '../validations/user.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import * as userController from '../controllers/user.controller.js';

const router = Router();

router.get('/me', isAuthenticated, asyncHandler(userController.getMyProfile));
router.put('/me', isAuthenticated, validateBody(updateProfileSchema), asyncHandler(userController.updateProfile));
router.get('/me/orders', isAuthenticated, validateQuery(userOrderQuerySchema), asyncHandler(userController.getMyOrders));
router.get('/me/seller/orders', isAuthenticated, requireMinRole('SELLER'), validateQuery(userOrderQuerySchema), asyncHandler(userController.getSellerOrders));
router.get('/me/notifications', isAuthenticated, validateQuery(notificationQuerySchema), asyncHandler(userController.getNotifications));
router.patch('/me/notifications/:id/read', isAuthenticated, validateParams(notificationIdParamSchema), asyncHandler(userController.markNotificationRead));
router.patch('/me/notifications/read-all', isAuthenticated, asyncHandler(userController.markAllNotificationsRead));

router.get('/:id', asyncHandler(userController.getProfile));
router.get('/:id/products', asyncHandler(userController.getPublicProducts));

export default router;
