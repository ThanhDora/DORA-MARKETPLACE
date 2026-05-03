import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
  });
};

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 2000,
  message: 'Quá nhiều yêu cầu từ IP này',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều yêu cầu',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều lần đăng nhập, vui lòng thử lại sau 15 phút',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Quá nhiều yêu cầu refresh token',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Quá nhiều webhook requests',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Quá nhiều file uploads',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler,
});
