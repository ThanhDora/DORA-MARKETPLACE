import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export const getMyPayouts = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { page = '1', limit = '10', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = { userId };
  if (status) where.status = String(status);

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.payout.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, payouts, { page: Number(page), limit: Number(limit), total });
};

export const getEarningsSummary = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const totalRevenueResult = await prisma.$queryRaw<[{ total: string }]>`
    SELECT COALESCE(SUM(oi."sellerPayoutAmount"), 0) as total
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE oi."sellerId" = ${userId} AND o.status = 'PAID'
  `;

  // availableBalance = tổng doanh thu - tổng payout đã hoàn thành (COMPLETED)
  // Cột "sellerPaidOut" không tồn tại trong schema, nên tính gián tiếp qua bảng Payout
  const [pendingBalanceResult, completedPayoutResult] = await Promise.all([
    prisma.payout.aggregate({
      where: { userId, status: 'PENDING' },
      _sum: { amount: true },
    }),
    prisma.payout.aggregate({
      where: { userId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(totalRevenueResult[0]?.total) || 0;
  const paidOut = Number(completedPayoutResult._sum?.amount) || 0;
  const availableBalance = Math.max(0, totalRevenue - paidOut);

  sendSuccess(res, {
    totalRevenue,
    availableBalance,
    pendingPayout: Number(pendingBalanceResult._sum?.amount) || 0,
    paidOut,
  });
};

export const getAllPayouts = async (req: Request, res: Response) => {
  const { page = '1', limit = '10', status, userId } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = {};
  if (status) where.status = String(status);
  if (userId) where.userId = Number(userId);

  const [payouts, total] = await Promise.all([
    prisma.payout.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.payout.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, payouts, { page: Number(page), limit: Number(limit), total });
};

export const updatePayoutStatus = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { status, transactionId } = req.body;

  if (!['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(status)) {
    throw ApiError.badRequest('Trạng thái không hợp lệ');
  }

  const payout = await prisma.payout.update({
    where: { id },
    data: { status, transactionId },
  });
  sendSuccess(res, payout, 'Cập nhật trạng thái payout thành công');
};
