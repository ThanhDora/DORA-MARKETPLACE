import { Router } from 'express';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { strictLimiter } from '../middleware/rateLimit.middleware.js';
import * as chatController from '../controllers/chat.controller.js';

const router = Router();

router.use(isAuthenticated);

router.get('/rooms', asyncHandler(chatController.getChatRooms));
router.get('/rooms/:roomId/messages', asyncHandler(chatController.getMessages));
router.post('/send', asyncHandler(chatController.sendMessage));

router.get('/ai/sessions', asyncHandler(chatController.getAISessions));
router.get('/ai/sessions/:sessionId/history', asyncHandler(chatController.getAIChatHistory));
router.post('/ai/chat', strictLimiter, asyncHandler(chatController.chatWithAI));

export default router;
