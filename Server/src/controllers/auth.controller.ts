import { Request, Response, type CookieOptions } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';
import { cacheClear } from '../lib/redis.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

function getRefreshCookieMaxAge(): number {
  const match = env.JWT_REFRESH_EXPIRES_IN.match(/^(\d+)([dhms])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000;
  const value = parseInt(match[1]);
  const unit = match[2];
  switch (unit) {
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'm': return value * 60 * 1000;
    case 's': return value * 1000;
    default: return 30 * 24 * 60 * 60 * 1000;
  }
}

function isCrossSiteAuth(): boolean {
  try {
    const frontend = new URL(env.FRONTEND_URL);
    const backend = new URL(env.BACKEND_URL);
    return frontend.protocol !== backend.protocol || frontend.hostname.toLowerCase() !== backend.hostname.toLowerCase();
  } catch {
    return false;
  }
}

function getRefreshCookieOptions(includeMaxAge = true): CookieOptions {
  const crossSite = isCrossSiteAuth();
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: crossSite && env.NODE_ENV === 'production' ? 'none' : 'lax',
    ...(includeMaxAge ? { maxAge: getRefreshCookieMaxAge() } : {}),
    path: '/',
  };
}
import {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  revokeRefreshToken,
  hashPassword,
  comparePassword,
  generateEmailVerificationToken,
  generatePasswordResetToken,
  verifyEmailToken,
  verifyPasswordResetToken,
} from '../lib/jwt.js';
import { sendEmail, emailTemplates } from '../lib/mailer.js';

// Input sanitization helpers
const sanitizeString = (input: string): string => {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, 500);
};

const sanitizeEmail = (email: string): string => {
  return email.trim().toLowerCase().slice(0, 254);
};

// JWT token format: base64url (no padding) + base64url + base64url
// base64url uses A-Z, a-z, 0-9, -, _
// JWT tokens from jsonwebtoken library use base64url encoding WITHOUT = padding in the payload
// but the full token string itself may contain dots, and the signature part may have special chars
const TOKEN_REGEX = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_=-]+\.[A-Za-z0-9_+/=-]+$/;
const isValidJWTFormat = (token: string): boolean => {
  return typeof token === 'string' && TOKEN_REGEX.test(token) && token.length <= 1000;
};

function getAuthenticatedUserId(req: Request): number {
  if (!req.user) {
    throw ApiError.unauthorized('Vui lòng đăng nhập');
  }
  return req.user.userId;
}

export const register = async (req: Request, res: Response) => {
  const name = sanitizeString(req.body.name);
  const email = sanitizeEmail(req.body.email);
  const password = req.body.password;

  if (!name || name.length < 2) throw ApiError.badRequest('Tên phải có ít nhất 2 ký tự');
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw ApiError.badRequest('Email không hợp lệ');
  if (!password || password.length < 8) throw ApiError.badRequest('Mật khẩu phải có ít nhất 8 ký tự');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.badRequest('Email đã được sử dụng');

  const hashedPassword = await hashPassword(password);
  const verificationToken = generateEmailVerificationToken(email);

  const user = await prisma.user.create({
    data: {
      name: name.slice(0, 100),
      email,
      password: hashedPassword,
      role: ['USER', 'SELLER'].includes(req.body.role) ? req.body.role : 'USER',
      isActive: true,
      emailVerificationToken: verificationToken,
    },
  });

  const verifyUrl = `${env.BACKEND_URL}/verify-email?token=${verificationToken}`;
  const emailContent = await emailTemplates.verification(name, verifyUrl);
  const emailSent = await sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (!emailSent) {
    logger.warn(`Email verification could not be sent to ${email}`);
  }

  const refreshToken = generateRefreshToken(user.id);
  await saveRefreshToken(user.id, refreshToken);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  // NOTE: Do NOT return accessToken on register — user must verify email first
  sendSuccess(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role } }, 'Đăng ký thành công! Vui lòng kiểm tra email để xác minh tài khoản trước khi đăng nhập.', 201);
};

export const login = async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);
  const password = req.body.password;

  if (!email || !password) throw ApiError.badRequest('Email và mật khẩu là bắt buộc');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');
  if (!user.password) throw ApiError.unauthorized('Tài khoản này không dùng mật khẩu. Vui lòng đăng nhập bằng phương thức đã đăng ký.');

  if (!user.isActive) throw ApiError.forbidden('Tài khoản đã bị khóa');

  if (!user.isEmailVerified) {
    throw ApiError.forbidden('Vui lòng xác minh email trước khi đăng nhập. Kiểm tra hộp thư email của bạn.');
  }

  const isValid = await comparePassword(password, user.password);
  if (!isValid) throw ApiError.unauthorized('Email hoặc mật khẩu không đúng');

  const accessToken = generateAccessToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await saveRefreshToken(user.id, refreshToken);

  // Gửi email thông báo đăng nhập
  const loginTime = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'Không xác định';
  const deviceInfo = req.headers['user-agent'] || 'Không xác định';

  // Gửi email bất đồng bộ (không blocking response)
  sendEmail({
    to: user.email,
    ...(await emailTemplates.loginAlert(user.name, loginTime, ipAddress, deviceInfo)),
  }).catch(err => logger.warn(`Không thể gửi email thông báo đăng nhập: ${err}`));

  if (user.role === 'ADMIN' || user.role === 'SELLER') {
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN /api/auth/login',
        entity: 'auth',
        ip: ipAddress,
        metadata: {
          method: 'POST',
          path: '/api/auth/login',
          statusCode: 200,
        },
      },
    }).catch(() => undefined);
  }

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  sendSuccess(res, { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken }, 'Đăng nhập thành công');
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (refreshToken && isValidJWTFormat(refreshToken)) {
    await revokeRefreshToken(refreshToken);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(false));
  sendSuccess(res, null, 'Đăng xuất thành công');
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!refreshToken || !isValidJWTFormat(refreshToken)) {
    throw ApiError.unauthorized('Refresh token không tìm thấy');
  }

  const { verifyRefreshToken } = await import('../lib/jwt.js');
  let decoded: { userId: number };
  try {
    decoded = await verifyRefreshToken(refreshToken);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Refresh token đã hết hạn, vui lòng đăng nhập lại');
    }
    throw ApiError.unauthorized('Refresh token không hợp lệ');
  }

  const tokenRecord = await prisma.refreshToken.findFirst({
    where: { token: refreshToken, userId: decoded.userId, isValid: true },
  });
  if (!tokenRecord) throw ApiError.unauthorized('Refresh token không hợp lệ');
  if (tokenRecord.expiresAt <= new Date()) {
    await revokeRefreshToken(refreshToken);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(false));
    throw ApiError.unauthorized('Refresh token đã hết hạn, vui lòng đăng nhập lại');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.isActive) throw ApiError.unauthorized('Người dùng không hợp lệ');

  if (!user.isEmailVerified) {
    throw ApiError.forbidden('Vui lòng xác minh email trước khi tiếp tục');
  }

  await revokeRefreshToken(refreshToken);

  const newRefreshToken = generateRefreshToken(user.id);
  await saveRefreshToken(user.id, newRefreshToken);

  const accessToken = generateAccessToken(user.id, user.email, user.role);

  res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, getRefreshCookieOptions());

  sendSuccess(res, {
    accessToken,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const token = req.query.token as string || req.body?.token as string;

  if (!token || !isValidJWTFormat(token)) {
    throw ApiError.badRequest('Token xác minh không tìm thấy hoặc không hợp lệ');
  }

  let email: string;
  try {
    email = await verifyEmailToken(token);
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw ApiError.badRequest('Link xác minh đã hết hạn. Vui lòng yêu cầu gửi lại email xác minh.');
    }
    if (err instanceof Error && err.name === 'JsonWebTokenError') {
      throw ApiError.badRequest('Token xác minh không hợp lệ. Vui lòng yêu cầu gửi lại email xác minh.');
    }
    throw ApiError.badRequest('Token xác minh không hợp lệ');
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw ApiError.badRequest('Tài khoản không tồn tại');
  }

  if (user.isEmailVerified) {
    throw ApiError.badRequest('Email đã được xác minh trước đó');
  }

  if (user.emailVerificationToken !== token) {
    throw ApiError.badRequest('Token không hợp lệ. Có thể bạn đã yêu cầu gửi lại email xác minh. Vui lòng sử dụng email xác minh mới nhất.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerificationToken: null },
  });

  sendSuccess(res, null, 'Xác minh email thành công');
};

export const resendVerification = async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);

  if (!email) throw ApiError.badRequest('Email là bắt buộc');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendSuccess(res, null, 'Nếu email tồn tại, email xác minh đã được gửi');
  }

  if (user.isEmailVerified) {
    return sendSuccess(res, null, 'Email đã được xác minh trước đó');
  }

  const verificationToken = generateEmailVerificationToken(user.email);
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerificationToken: verificationToken },
  });

  const verifyUrl = `${env.BACKEND_URL}/verify-email?token=${verificationToken}`;
  const emailContent = await emailTemplates.verification(user.name, verifyUrl);
  const emailSent = await sendEmail({
    to: user.email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  if (!emailSent) {
    throw ApiError.internal('Không thể gửi email xác minh. Vui lòng thử lại sau.');
  }

  sendSuccess(res, null, 'Email xác minh đã được gửi');
};

export const forgotPassword = async (req: Request, res: Response) => {
  const email = sanitizeEmail(req.body.email);

  if (!email) throw ApiError.badRequest('Email là bắt buộc');

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return sendSuccess(res, null, 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi');
  }

  const resetToken = generatePasswordResetToken(user.id);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordResetToken: resetToken, passwordResetExpires: new Date(Date.now() + 3600000) },
  });

  const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  const emailContent = await emailTemplates.passwordReset(user.name, resetUrl);
  await sendEmail({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
  });

  sendSuccess(res, null, 'Nếu email tồn tại, link đặt lại mật khẩu đã được gửi');
};

export const resetPassword = async (req: Request, res: Response) => {
  const token = req.body.token as string;
  const password = req.body.password;

  if (!token || !isValidJWTFormat(token)) throw ApiError.badRequest('Token không hợp lệ');
  if (!password || password.length < 8) throw ApiError.badRequest('Mật khẩu phải có ít nhất 8 ký tự');

  const userId = await verifyPasswordResetToken(token);
  const user = await prisma.user.findFirst({
    where: { id: userId, passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
  });

  if (!user) throw ApiError.badRequest('Token không hợp lệ hoặc đã hết hạn');

  const hashedPassword = await hashPassword(password);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, passwordResetToken: null, passwordResetExpires: null },
  });

  // Revoke all refresh tokens for security
  await prisma.refreshToken.updateMany({
    where: { userId: user.id },
    data: { isValid: false },
  });

  sendSuccess(res, null, 'Đặt lại mật khẩu thành công');
};

export const changePassword = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const currentPassword = req.body.currentPassword;
  const newPassword = req.body.newPassword;

  if (!currentPassword || !newPassword) throw ApiError.badRequest('Mật khẩu là bắt buộc');
  if (newPassword.length < 8) throw ApiError.badRequest('Mật khẩu mới phải có ít nhất 8 ký tự');
  if (currentPassword === newPassword) throw ApiError.badRequest('Mật khẩu mới phải khác mật khẩu cũ');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

  if (user.password) {
    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) throw ApiError.badRequest('Mật khẩu hiện tại không đúng');
  } else {
    throw ApiError.badRequest('Tài khoản đăng nhập qua mạng xã hội. Vui lòng xác minh email và sử dụng chức năng đặt lại mật khẩu.');
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashedPassword },
  });

  sendSuccess(res, null, 'Đổi mật khẩu thành công');
};

export const googleAuth = async (req: Request, res: Response) => {
  const { idToken } = req.body;

  if (!idToken || !isValidJWTFormat(idToken)) {
    throw ApiError.badRequest('Token không hợp lệ');
  }

  const { OAuth2Client } = await import('google-auth-library');
  const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();
  if (!payload || !payload.email) throw ApiError.badRequest('Token không hợp lệ');

  let user = await prisma.user.findFirst({
    where: { email: payload.email },
    include: { oauthAccounts: true },
  });

  if (!user) {
    const newUser = await prisma.user.create({
      data: {
        name: sanitizeString(payload.name || payload.email.split('@')[0] || 'User'),
        email: sanitizeEmail(payload.email),
        avatar: payload.picture || null,
        isEmailVerified: true,
        isActive: true,
        role: 'USER',
        oauthAccounts: {
          create: {
            provider: 'google',
            providerUserId: payload.sub,
          },
        },
      },
    });
    user = newUser as typeof user;
  }

  const accessToken = generateAccessToken(user.id, user.email, user.role);
  const refreshToken = generateRefreshToken(user.id);
  await saveRefreshToken(user.id, refreshToken);

  res.cookie(REFRESH_COOKIE_NAME, refreshToken, getRefreshCookieOptions());

  const userData = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
  };

  sendSuccess(res, { user: userData, accessToken }, 'Đăng nhập Google thành công');
};

export const me = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatar: true,
      phone: true,
      bio: true,
      address: true,
      isEmailVerified: true,
      createdAt: true,
    },
  });

  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

  sendSuccess(res, user);
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const confirmPassword = req.body.confirmPassword;

  if (!confirmPassword) throw ApiError.badRequest('Mật khẩu xác nhận là bắt buộc');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

  if (user.password) {
    const isValid = await comparePassword(confirmPassword, user.password);
    if (!isValid) throw ApiError.badRequest('Mật khẩu xác nhận không đúng');
  } else {
    throw ApiError.badRequest('Tài khoản không có mật khẩu, không thể xóa bằng phương thức này');
  }

  // Xóa tất cả related data trước (vì Order không có cascade)
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.deleteMany({ where: { order: { userId } } });
    await tx.order.deleteMany({ where: { userId } });
    await tx.cartItem.deleteMany({ where: { userId } });
    await tx.wishlist.deleteMany({ where: { userId } });
    await tx.review.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.activityLog.deleteMany({ where: { userId } });
    await tx.orderItem.updateMany({ where: { sellerId: userId }, data: { sellerId: null } });
    await tx.product.deleteMany({ where: { sellerId: userId } });
    await tx.productFile.deleteMany({ where: { product: { sellerId: userId } } });
    await tx.aIChatSession.deleteMany({ where: { userId } });
    await tx.message.deleteMany({
      where: { OR: [{ senderId: userId }, { receiverId: userId }] },
    });
    await tx.payout.deleteMany({ where: { userId } });
    await tx.walletTransaction.deleteMany({ where: { userId } });
    await tx.sellerPaymentConfig.deleteMany({ where: { userId } });
    await tx.sellerSubscription.deleteMany({ where: { userId } });
    await tx.refreshToken.deleteMany({ where: { userId } });
    await tx.oAuthAccount.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  try {
    await cacheClear(`refresh_token:*`);
  } catch (e) {
    logger.warn(`Redis cleanup failed for user ${userId}: ${e}`);
  }

  res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions(false));

  sendSuccess(res, null, 'Xóa tài khoản thành công');
};
