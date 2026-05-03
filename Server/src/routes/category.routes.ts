import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { createCategorySchema, updateCategorySchema } from '../validations/product.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import * as categoryController from '../controllers/category.controller.js';

const router = Router();

router.get('/', asyncHandler(categoryController.listCategories));
router.get('/:id', asyncHandler(categoryController.getCategory));
router.post('/', isAuthenticated, requireRole('ADMIN'), validateBody(createCategorySchema), asyncHandler(categoryController.createCategory));
router.put('/:id', isAuthenticated, requireRole('ADMIN'), validateBody(updateCategorySchema), asyncHandler(categoryController.updateCategory));
router.delete('/:id', isAuthenticated, requireRole('ADMIN'), asyncHandler(categoryController.deleteCategory));

export default router;
