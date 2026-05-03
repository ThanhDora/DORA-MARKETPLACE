import { Router } from 'express';
import { validateBody } from '../middleware/validate.middleware.js';
import { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, changePasswordSchema, resendVerificationSchema, deleteAccountSchema } from '../validations/auth.validation.js';
import { asyncHandler } from '../utils/ApiError.js';
import { isAuthenticated } from '../middleware/auth.middleware.js';
import { authLimiter, strictLimiter, refreshLimiter } from '../middleware/rateLimit.middleware.js';
import * as authController from '../controllers/auth.controller.js';

const router = Router();

router.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(authController.login));
router.post('/logout', asyncHandler(authController.logout));
router.post('/refresh', refreshLimiter, asyncHandler(authController.refresh));
// verify-email: accepts both GET (from email link in browser) and POST (API call)
// GET: from email link click → browser → server-rendered page
// POST: from SPA/mobile client
router.get('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/verify-email', asyncHandler(authController.verifyEmail));
router.post('/resend-verification', authLimiter, validateBody(resendVerificationSchema), asyncHandler(authController.resendVerification));
router.post('/forgot-password', authLimiter, validateBody(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
router.post('/reset-password', strictLimiter, validateBody(resetPasswordSchema), asyncHandler(authController.resetPassword));
router.post('/change-password', isAuthenticated, validateBody(changePasswordSchema), asyncHandler(authController.changePassword));
router.post('/google', authLimiter, asyncHandler(authController.googleAuth));
router.get('/me', isAuthenticated, asyncHandler(authController.me));
router.post('/delete-account', isAuthenticated, validateBody(deleteAccountSchema), asyncHandler(authController.deleteAccount));

export default router;
