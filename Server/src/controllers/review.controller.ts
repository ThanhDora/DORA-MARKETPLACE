import { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

async function getReviewStats(productId: number) {
  const [avgRating, reviewCount] = await Promise.all([
    prisma.review.aggregate({
      where: { productId },
      _avg: { rating: true },
    }),
    prisma.review.count({ where: { productId } }),
  ]);

  return {
    rating: Number(avgRating._avg.rating || 0),
    reviewsCount: reviewCount,
  };
}

async function emitReviewRealtime(
  req: Request,
  productId: number,
  eventType: 'created' | 'updated' | 'deleted',
  reviewId?: number,
) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;

  const metrics = await getReviewStats(productId);
  io.emit('product:metrics:update', {
    productId: String(productId),
    rating: metrics.rating,
    reviewsCount: metrics.reviewsCount,
  });
  io.emit('product:review:updated', {
    productId: String(productId),
    type: eventType,
    reviewId,
    rating: metrics.rating,
    reviewsCount: metrics.reviewsCount,
    updatedAt: new Date().toISOString(),
  });
}

export const listProductReviews = async (req: Request, res: Response) => {
  const productId = Number(req.params.productId);
  const { page = '1', limit = '10', sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = { productId };
  const orderBy: any = {};
  orderBy[String(sortBy)] = sortOrder;

  const [reviews, total, stats] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take,
      orderBy,
      include: { user: { select: { id: true, name: true, avatar: true } } },
    }),
    prisma.review.count({ where }),
    prisma.review.groupBy({
      by: ['rating'],
      where: { productId },
      _count: true,
    }),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  stats.forEach(s => { distribution[s.rating as keyof typeof distribution] = s._count; });

  const avgRating = await prisma.review.aggregate({
    where: { productId },
    _avg: { rating: true },
  });

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendSuccess(res, {
    data: reviews,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total,
    },
    stats: {
      averageRating: avgRating._avg.rating || 0,
      distribution,
    },
  });
};

export const createReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId, rating, content } = req.body;

  if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw ApiError.badRequest('Đánh giá phải là số nguyên từ 1 đến 5');
  }

  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  if (product.sellerId === userId) throw ApiError.badRequest('Bạn không thể đánh giá sản phẩm của chính mình');

  const hasPurchased = await prisma.orderItem.findFirst({
    where: {
      productId: Number(productId),
      order: {
        userId,
        status: { notIn: ['PENDING', 'CANCELLED', 'FAILED'] },
      },
    },
  });
  if (!hasPurchased) throw ApiError.forbidden('Bạn cần mua sản phẩm trước khi đánh giá');

  const existing = await prisma.review.findFirst({
    where: { userId, productId: Number(productId) },
  });
  if (existing) throw ApiError.badRequest('Bạn đã đánh giá sản phẩm này');

  const review = await prisma.review.create({
    data: { userId, productId: Number(productId), rating, content: String(content ?? '') },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  await emitReviewRealtime(req, Number(productId), 'created', review.id);
  sendSuccess(res, review, 'Đánh giá thành công', 201);
};

export const updateReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);
  const { rating, content } = req.body;

  const review = await prisma.review.findFirst({
    where: { id, userId },
  });

  if (!review) throw ApiError.notFound('Không tìm thấy đánh giá');

  const updated = await prisma.review.update({
    where: { id },
    data: {
      ...(rating !== undefined && { rating }),
      ...(content !== undefined && { content }),
    },
    include: { user: { select: { id: true, name: true, avatar: true } } },
  });

  await emitReviewRealtime(req, review.productId, 'updated', updated.id);
  sendSuccess(res, updated, 'Cập nhật đánh giá thành công');
};

export const deleteReview = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);

  const review = await prisma.review.findFirst({
    where: { id, userId },
  });

  if (!review) throw ApiError.notFound('Không tìm thấy đánh giá');

  await prisma.review.delete({ where: { id } });
  await emitReviewRealtime(req, review.productId, 'deleted', id);
  sendSuccess(res, null, 'Xóa đánh giá thành công');
};
