import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import * as orderController from '../controllers/order.controller.js';
import { validateQuery, validateBody, validateParams } from '../middleware/validate.middleware.js';
import { createOrderSchema, updateOrderStatusSchema, orderIdParamSchema, orderQuerySchema } from '../validations/order.validation.js';

const router = Router();

// Tạo đơn hàng mới
router.post('/', isAuthenticated, validateBody(createOrderSchema), asyncHandler(orderController.createOrder));

// Lấy danh sách đơn hàng (buyer)
router.get('/', isAuthenticated, validateQuery(orderQuerySchema), asyncHandler(orderController.getOrders));

// Lấy danh sách đơn hàng với tư cách seller
router.get('/seller', isAuthenticated, validateQuery(orderQuerySchema), asyncHandler(orderController.getSellerOrders));

// Lấy chi tiết đơn hàng
router.get('/:id', isAuthenticated, validateParams(orderIdParamSchema), asyncHandler(orderController.getOrder));

// Cập nhật trạng thái đơn hàng
router.patch('/:id/status', isAuthenticated, validateParams(orderIdParamSchema), validateBody(updateOrderStatusSchema), asyncHandler(orderController.updateOrderStatus));

// Hủy đơn hàng
router.patch('/:id/cancel', isAuthenticated, validateParams(orderIdParamSchema), asyncHandler(orderController.cancelOrder));

export default router;
