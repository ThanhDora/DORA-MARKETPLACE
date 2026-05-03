import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { PaymentMethod } from '@prisma/client';

function toInternalPaymentMethod(value: unknown): PaymentMethod {
  const candidate = String(value ?? '').toUpperCase();
  const normalized = candidate;
  if (!Object.values(PaymentMethod).includes(normalized as PaymentMethod)) {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
  return normalized as PaymentMethod;
}

function toPublicPaymentMethod<T extends { method: string }>(record: T): T {
  return {
    ...record,
    method: record.method,
  };
}

export const getSubscriptionPlans = async (req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
  sendSuccess(res, plans);
};

export const getMySubscription = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const subscription = await prisma.sellerSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { plan: true },
    orderBy: { endDate: 'desc' },
  });
  sendSuccess(res, subscription);
};

export const createSubscription = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { planId } = req.body;

  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: Number(planId) } });
  if (!plan) throw ApiError.notFound('Không tìm thấy gói subscription');

  const existing = await prisma.sellerSubscription.findFirst({
    where: { userId, status: 'ACTIVE' },
  });
  if (existing) throw ApiError.badRequest('Bạn đã có subscription đang hoạt động');

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + plan.durationDays);

  const subscription = await prisma.sellerSubscription.create({
    data: {
      userId,
      planId,
      status: 'PENDING',
      startDate,
      endDate,
      autoRenew: true,
    },
    include: { plan: true },
  });

  sendSuccess(res, subscription, 'Đăng ký subscription thành công, vui lòng chờ xác nhận thanh toán', 201);
};

export const expireSubscriptions = async () => {
  const now = new Date();
  const expired = await prisma.sellerSubscription.findMany({
    where: { status: 'ACTIVE', endDate: { lt: now }, autoRenew: false },
  });

  for (const sub of expired) {
    await prisma.sellerSubscription.update({
      where: { id: sub.id },
      data: { status: 'EXPIRED' },
    });

    const hasActive = await prisma.sellerSubscription.findFirst({
      where: { userId: sub.userId, status: 'ACTIVE' },
    });
    if (!hasActive) {
      await prisma.user.update({
        where: { id: sub.userId },
        data: { role: 'USER' },
      });
    }
  }

  return expired.length;
};

export const getSellerStats = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const [productCount, orderCount, revenueResult, pendingPayout] = await Promise.all([
    prisma.product.count({ where: { sellerId: userId } }),
    prisma.orderItem.count({
      where: { sellerId: userId, order: { status: 'PAID' } },
    }),
    prisma.orderItem.aggregate({
      where: { sellerId: userId, order: { status: 'PAID' } },
      _sum: { sellerPayoutAmount: true },
    }),
    prisma.payout.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
  ]);

  sendSuccess(res, {
    productCount,
    orderCount,
    totalRevenue: revenueResult._sum.sellerPayoutAmount || 0,
    pendingPayout: pendingPayout._sum.amount || 0,
  });
};

export const getPaymentConfigs = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const configs = await prisma.sellerPaymentConfig.findMany({ where: { userId } });
  sendSuccess(res, configs.map((item) => toPublicPaymentMethod(item)));
};

export const createPaymentConfig = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { config } = req.body;
  const method = toInternalPaymentMethod(req.body.method);

  const existing = await prisma.sellerPaymentConfig.findFirst({
    where: { userId, method },
  });
  if (existing) throw ApiError.badRequest('Đã tồn tại cấu hình cho phương thức này');

  const paymentConfig = await prisma.sellerPaymentConfig.create({
    data: { userId, method, config, isActive: true },
  });
  sendSuccess(res, toPublicPaymentMethod(paymentConfig), 'Tạo cấu hình thanh toán thành công', 201);
};

export const updatePaymentConfig = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);
  const { config, isActive } = req.body;

  const existing = await prisma.sellerPaymentConfig.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Không tìm thấy cấu hình');
  if (existing.userId !== userId) throw ApiError.forbidden('Bạn không có quyền sửa cấu hình này');

  const paymentConfig = await prisma.sellerPaymentConfig.update({
    where: { id },
    data: { ...(config && { config }), ...(isActive !== undefined && { isActive }) },
  });
  sendSuccess(res, toPublicPaymentMethod(paymentConfig), 'Cập nhật cấu hình thanh toán thành công');
};

export const deletePaymentConfig = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);

  const existing = await prisma.sellerPaymentConfig.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Không tìm thấy cấu hình');
  if (existing.userId !== userId) throw ApiError.forbidden('Bạn không có quyền xóa cấu hình này');

  await prisma.sellerPaymentConfig.delete({ where: { id } });
  sendSuccess(res, null, 'Xóa cấu hình thanh toán thành công');
};
