import { Router } from 'express';
import { validateBody, validateQuery } from '../middleware/validate.middleware.js';
import {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
} from '../validations/product.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated, optionalAuth } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import { uploadImage } from '../middleware/upload.middleware.js';
import * as productController from '../controllers/product.controller.js';
import * as adminController from '../controllers/admin.controller.js';

const router = Router();

router.get('/', validateQuery(productQuerySchema), asyncHandler(productController.listProducts));
router.get('/suggestions', asyncHandler(productController.suggestProducts));
router.post('/:id/view', asyncHandler(productController.trackProductView));
router.get('/:id', optionalAuth, asyncHandler(productController.getProduct));

router.post('/upload-images', isAuthenticated, requireMinRole('SELLER'), uploadImage.array('images', 12), asyncHandler(productController.uploadProductImages));
router.post('/', isAuthenticated, requireMinRole('SELLER'), validateBody(createProductSchema), asyncHandler(productController.createProduct));
router.put('/:id', isAuthenticated, requireMinRole('SELLER'), validateBody(updateProductSchema), asyncHandler(productController.updateProduct));
router.delete('/:id', isAuthenticated, requireMinRole('SELLER'), asyncHandler(productController.deleteProduct));
router.get('/seller/my', isAuthenticated, requireMinRole('SELLER'), asyncHandler(productController.listSellerProducts));

router.patch('/:id/approve', isAuthenticated, requireMinRole('ADMIN'), asyncHandler(adminController.approveProduct));
router.patch('/:id/reject', isAuthenticated, requireMinRole('ADMIN'), asyncHandler(adminController.rejectProduct));

export default router;
