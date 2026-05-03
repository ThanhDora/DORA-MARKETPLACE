import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireRole, requireMinRole } from '../middleware/rbac.middleware.js';
import * as payoutController from '../controllers/payout.controller.js';

const router = Router();

router.use(isAuthenticated);
router.get('/', requireMinRole('SELLER'), asyncHandler(payoutController.getMyPayouts));
router.get('/summary', requireMinRole('SELLER'), asyncHandler(payoutController.getEarningsSummary));
router.get('/all', requireRole('ADMIN'), asyncHandler(payoutController.getAllPayouts));
router.patch('/:id', requireRole('ADMIN'), asyncHandler(payoutController.updatePayoutStatus));

export default router;
