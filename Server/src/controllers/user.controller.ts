import { Request, Response } from 'express';
import { OrderStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

function getAuthenticatedUserId(req: Request): number {
  if (!req.user) {
    throw ApiError.unauthorized('Vui lòng đăng nhập');
  }
  return req.user.userId;
}

function parseOrderStatus(input: unknown): OrderStatus {
  const status = String(input ?? '');
  if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
    throw ApiError.badRequest('Trạng thái đơn hàng không hợp lệ');
  }
  return status as OrderStatus;
}

export const getProfile = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw ApiError.badRequest('ID người dùng không hợp lệ');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatar: true,
      bio: true,
      address: true,
      role: true,
      createdAt: true,
      _count: { select: { products: true, orders: true } },
    },
  });

  if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

  sendSuccess(res, user);
};

export const getMyProfile = async (req: Request, res: Response) => {
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

  sendSuccess(res, user);
};

export const updateProfile = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const { name, phone, avatar, bio, address } = req.body;

  if (name && name.length > 100) throw ApiError.badRequest('Tên không được vượt quá 100 ký tự');
  if (phone && phone.length > 20) throw ApiError.badRequest('Số điện thoại không được vượt quá 20 ký tự');
  if (bio && bio.length > 500) throw ApiError.badRequest('Bio không được vượt quá 500 ký tự');
  if (address && address.length > 300) throw ApiError.badRequest('Địa chỉ không được vượt quá 300 ký tự');

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(name !== undefined && { name }),
      ...(phone !== undefined && { phone }),
      ...(avatar !== undefined && { avatar }),
      ...(bio !== undefined && { bio }),
      ...(address !== undefined && { address }),
    },
    select: { id: true, name: true, email: true, role: true, avatar: true, phone: true, bio: true, address: true },
  });

  sendSuccess(res, user, 'Cập nhật profile thành công');
};

export const getMyOrders = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const { page = '1', limit = '10', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.OrderWhereInput = { userId };
  if (status) where.status = parseOrderStatus(status);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, orders, { page: Number(page), limit: Number(limit), total });
};

export const getSellerOrders = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const { page = '1', limit = '10', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const orderStatusFilter = status ? { status: parseOrderStatus(status) } : {};

  const [orderItems, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: {
        sellerId: userId,
        ...(status ? { order: orderStatusFilter } : {}),
      },
      include: {
        order: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        product: { select: { id: true, name: true } },
      },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.orderItem.count({
      where: {
        sellerId: userId,
        ...(status ? { order: orderStatusFilter } : {}),
      },
    }),
  ]);

  const orders = orderItems.map(item => ({
    ...item.order,
    items: [item],
  }));

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, orders, { page: Number(page), limit: Number(limit), total });
};

export const getNotifications = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const { page = '1', limit = '20', isRead } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.NotificationWhereInput = { userId };
  if (isRead !== undefined) where.isRead = isRead === 'true';

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, notifications, { page: Number(page), limit: Number(limit), total });
};

export const markNotificationRead = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  const id = Number(req.params.id);

  const notification = await prisma.notification.findFirst({
    where: { id, userId },
  });

  if (!notification) throw ApiError.notFound('Không tìm thấy thông báo');

  await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });

  sendSuccess(res, null, 'Đánh dấu đã đọc thành công');
};

export const markAllNotificationsRead = async (req: Request, res: Response) => {
  const userId = getAuthenticatedUserId(req);
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  sendSuccess(res, null, 'Đánh dấu tất cả đã đọc thành công');
};

export const getPublicProducts = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) throw ApiError.badRequest('ID người dùng không hợp lệ');

  const { page = '1', limit = '12', type } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: any = { sellerId: id, status: 'APPROVED' };
  if (type && ['ACCOUNT', 'KEY', 'FILE'].includes(String(type))) {
    where.type = String(type);
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        seller: { select: { id: true, name: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const productIds = products.map((p) => p.id);
  const ratingAggregates = await prisma.review.groupBy({
    by: ['productId'],
    where: { productId: { in: productIds } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(ratingAggregates.map((r) => [r.productId, Number(r._avg.rating) || 0]));
  const result = products.map((p) => ({ ...p, averageRating: ratingMap.get(p.id) ?? 0 }));

  sendList(res, result, { page: Number(page), limit: Number(limit), total });
};
