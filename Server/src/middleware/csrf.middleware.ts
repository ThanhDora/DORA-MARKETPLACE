import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || process.env.JWT_SECRET;

if (!CSRF_SECRET) {
  console.error('[FATAL] Neither CSRF_SECRET nor JWT_SECRET is set. CSRF protection disabled.');
}

export const generateCsrfToken = (sessionId: string): string => {
  const timestamp = Math.floor(Date.now() / 1000);
  const payload = `${sessionId}:${timestamp}`;
  const signature = crypto.createHmac('sha256', CSRF_SECRET).update(payload).digest('hex');
  return `${payload}:${signature}`;
};

export const validateCsrfToken = (token: string, sessionId: string): boolean => {
  if (!token || !sessionId || !CSRF_SECRET) return false;

  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [sid, timestampStr, signature] = parts;
  if (sid !== sessionId) return false;

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;
  if (age < 0 || age > 3600) return false;

  const expectedSignature = crypto.createHmac('sha256', CSRF_SECRET)
    .update(`${sid}:${timestampStr}`)
    .digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (sigBuffer.length !== expectedBuffer.length) return false;
  if (!crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
    return false;
  }

  return true;
};

export const csrfMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const sessionId = String((req as any).user?.userId || '');
  if (!sessionId) {
    return res.status(403).json({ success: false, message: 'CSRF token requires authentication' });
  }
  const token = req.headers['x-csrf-token'] as string;
  const origin = req.headers.origin;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';

  try {
    const allowedOrigin = new URL(frontendUrl);
    if (origin) {
      const originUrl = new URL(origin);
      if (originUrl.origin !== allowedOrigin.origin) {
        return res.status(403).json({ success: false, message: 'Invalid origin' });
      }
    }
  } catch {
    if (origin && origin !== frontendUrl) {
      return res.status(403).json({ success: false, message: 'Invalid origin' });
    }
  }

  if (!token) {
    return res.status(403).json({ success: false, message: 'CSRF token missing' });
  }

  if (!validateCsrfToken(token, sessionId)) {
    return res.status(403).json({ success: false, message: 'CSRF token invalid' });
  }

  next();
};
