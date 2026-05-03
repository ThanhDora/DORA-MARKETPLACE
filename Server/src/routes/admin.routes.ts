import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { createPlanSchema } from '../validations/subscription.validation.js';
import { broadcastNotificationSchema, updateNotificationSchema } from '../validations/user.validation.js';
import * as adminController from '../controllers/admin.controller.js';

const router = Router();

router.use(isAuthenticated);
router.use(requireRole('ADMIN'));

router.get('/dashboard', asyncHandler(adminController.getDashboardStats));
router.get('/users', asyncHandler(adminController.getUsers));
router.post('/users', asyncHandler(adminController.createUser));
router.patch('/users/:id', asyncHandler(adminController.updateUser));
router.patch('/users/:id/role', asyncHandler(adminController.updateUserRole));
router.patch('/users/:id/suspend', asyncHandler(adminController.suspendUser));
router.post('/users/:id/subscription', asyncHandler(adminController.grantSellerPlan));
router.post('/users/:id/deposit', asyncHandler(adminController.depositToUser));
router.delete('/users/:id', asyncHandler(adminController.deleteUser));
router.get('/products/pending', asyncHandler(adminController.getPendingProducts));
router.post('/products/approve-all', asyncHandler(adminController.approveAllProducts));
router.patch('/products/:id/approve', asyncHandler(adminController.approveProduct));
router.patch('/products/:id/reject', asyncHandler(adminController.rejectProduct));
router.get('/plans', asyncHandler(adminController.getPlans));
router.post('/plans', validate(createPlanSchema), asyncHandler(adminController.createPlan));
router.patch('/plans/:id', asyncHandler(adminController.updatePlan));
router.delete('/plans/:id', asyncHandler(adminController.deletePlan));
router.get('/activity-logs', asyncHandler(adminController.getActivityLogs));
router.get('/notifications/mine', asyncHandler(adminController.getMyNotifications));
router.post('/notifications/broadcast', validate(broadcastNotificationSchema), asyncHandler(adminController.sendBroadcastNotification));
router.patch('/notifications/:id', validate(updateNotificationSchema), asyncHandler(adminController.updateNotification));
router.delete('/notifications/:id', asyncHandler(adminController.deleteNotification));

export default router;
