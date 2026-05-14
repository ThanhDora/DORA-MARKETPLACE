import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { requireMinRole } from '../middleware/rbac.middleware.js';
import * as ctrl from '../controllers/support.controller.js';

const router = Router();

router.use(isAuthenticated);

// User routes
router.get('/ticket', asyncHandler(ctrl.getOrCreateTicket));
router.get('/ticket/:id/messages', asyncHandler(ctrl.getTicketMessages));
router.post('/ticket/:id/message', asyncHandler(ctrl.sendUserMessage));
router.post('/ticket/:id/escalate', asyncHandler(ctrl.escalateToHuman));
router.patch('/ticket/:id/close', asyncHandler(ctrl.closeTicket));

// Admin routes
router.get('/admin/tickets', requireMinRole('ADMIN'), asyncHandler(ctrl.adminListTickets));
router.get('/admin/tickets/stats', requireMinRole('ADMIN'), asyncHandler(ctrl.adminTicketStats));
router.get('/admin/tickets/:id/messages', requireMinRole('ADMIN'), asyncHandler(ctrl.adminGetMessages));
router.post('/admin/tickets/:id/reply', requireMinRole('ADMIN'), asyncHandler(ctrl.adminReply));
router.patch('/admin/tickets/:id/close', requireMinRole('ADMIN'), asyncHandler(ctrl.adminCloseTicket));

export default router;
