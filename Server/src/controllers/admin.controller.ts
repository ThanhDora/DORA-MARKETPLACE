import { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { createAndEmit, createAndEmitBulk } from '../services/notification.service.js';

export const depositToUser = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { amount: rawAmount, description: rawDescription } = req.body;
  const adminId = (req as any).user?.userId;

  const amount = Number(rawAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw ApiError.badRequest('Số tiền không hợp lệ');
  }
  if (amount > 100000000) {
    throw ApiError.badRequest('Số tiền nạp tối đa là 100,000,000 VND');
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!targetUser) {
    throw ApiError.notFound('Không tìm thấy người dùng');
  }

  const description = rawDescription
    ? String(rawDescription).trim()
    : `Admin cộng tiền thủ công`;

  const result = await prisma.$transaction(async (tx) => {
    const walletTx = await tx.walletTransaction.create({
      data: {
        userId,
        amount,
        type: 'DEPOSIT',
        status: 'COMPLETED',
        paymentMethod: 'BANK_TRANSFER',
        description,
        metadata: { adminId, manualDeposit: true },
      },
    });

    const user = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
      select: { balance: true },
    });

    const notification = await tx.notification.create({
      data: {
        userId,
        title: 'Nạp tiền thành công',
        content: `Bạn đã được admin cộng ${amount.toLocaleString('vi-VN')} VND vào ví. Lý do: ${description}`,
        type: 'PAYMENT',
        metadata: { walletTransactionId: walletTx.id, amount, adminId, manualDeposit: true },
      },
    });

    return { walletTx, balance: Number(user.balance), notification };
  });

  const io = req.app.get('io') as SocketIOServer | undefined;
  if (io) {
    io.to(`user:${userId}`).emit('wallet:updated', {
      balance: result.balance,
      transactionId: result.walletTx.id,
      amount,
    });
    io.to(`user:${userId}`).emit('notification:new', {
      id: result.notification.id,
      title: result.notification.title,
      content: result.notification.content,
      type: result.notification.type,
      createdAt: result.notification.createdAt.toISOString(),
    });
  }

  sendSuccess(
    res,
    {
      transactionId: result.walletTx.id,
      userId,
      amount,
      newBalance: result.balance,
    },
    `Đã cộng ${amount.toLocaleString('vi-VN')} VND vào ví của ${targetUser.name || targetUser.email}`,
  );
};

export const getDashboardStats = async (req: Request, res: Response) => {
  const [userCount, productCount, orderCount, revenueResult] = await Promise.all([
    prisma.user.count(),
    prisma.product.count(),
    prisma.order.count({ where: { status: 'PAID' } }),
    prisma.order.aggregate({
      where: { status: 'PAID' },
      _sum: { totalAmount: true },
    }),
  ]);

  const pendingProducts = await prisma.product.count({ where: { status: 'PENDING' } });

  const recentOrders = await prisma.order.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  interface TopSeller {
    sellerId: number;
    revenue: string | number;
    orderCount: string | number;
  }

  const topSellers = await prisma.$queryRaw<TopSeller[]>`
    SELECT oi."sellerId", SUM(oi."sellerPayoutAmount") as revenue, COUNT(*) as "orderCount"
    FROM "OrderItem" oi
    JOIN "Order" o ON o.id = oi."orderId"
    WHERE o.status = 'PAID' AND oi."sellerId" IS NOT NULL
    GROUP BY oi."sellerId"
    ORDER BY revenue DESC
    LIMIT 10
  `;

  const sellerIds = topSellers.map(s => s.sellerId).filter(Boolean) as number[];
  const sellers = await prisma.user.findMany({
    where: { id: { in: sellerIds } },
    select: { id: true, name: true, email: true },
  });

  const topSellersData = topSellers.map(s => {
    const seller = sellers.find(u => u.id === s.sellerId);
    return {
      seller,
      totalRevenue: Number(s.revenue) || 0,
      orderCount: Number(s.orderCount) || 0,
    };
  });

  sendSuccess(res, {
    users: userCount,
    products: productCount,
    orders: orderCount,
    revenue: revenueResult._sum.totalAmount || 0,
    pendingProducts,
    recentOrders,
    topSellers: topSellersData,
  });
};

export const getUsers = async (req: Request, res: Response) => {
  const { page = '1', limit = '10', search, role, isActive } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.UserWhereInput = {};
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { email: { contains: String(search), mode: 'insensitive' } },
    ];
  }
  if (role) where.role = String(role) as 'USER' | 'SELLER' | 'ADMIN';
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take,
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        phone: true,
        bio: true,
        address: true,
        role: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
        subscription: {
          where: { status: 'ACTIVE' },
          orderBy: { endDate: 'desc' },
          take: 1,
          include: { plan: true },
        },
        _count: { select: { products: true, orders: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, users, { page: Number(page), limit: Number(limit), total });
};

export const createUser = async (req: Request, res: Response) => {
  const { name, email, password, role = 'USER', isActive = true } = req.body;

  if (!name || !email || !password) {
    throw ApiError.badRequest('Tên, email và mật khẩu là bắt buộc');
  }
  if (!['USER', 'SELLER', 'ADMIN'].includes(role)) {
    throw ApiError.badRequest('Role không hợp lệ');
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    throw ApiError.conflict('Email đã tồn tại');
  }

  const hashedPassword = await bcrypt.hash(String(password), 12);
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role,
      isActive: Boolean(isActive),
      isEmailVerified: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
  });

  sendSuccess(res, user, 'Tạo user thành công', 201);
};

export const updateUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, email, phone, bio, address, role, isActive } = req.body;

  if (role !== undefined && !['USER', 'SELLER', 'ADMIN'].includes(role)) {
    throw ApiError.badRequest('Role không hợp lệ');
  }

  const data: Prisma.UserUpdateInput = {};
  if (name !== undefined) data.name = String(name).trim();
  if (email !== undefined) data.email = String(email).trim().toLowerCase();
  if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
  if (bio !== undefined) data.bio = bio ? String(bio).trim() : null;
  if (address !== undefined) data.address = address ? String(address).trim() : null;
  if (role !== undefined) data.role = role;
  if (isActive !== undefined) data.isActive = Boolean(isActive);

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, phone: true, bio: true, address: true, role: true, isActive: true },
  });

  sendSuccess(res, user, 'Cập nhật user thành công');
};

export const updateUserRole = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { role } = req.body;

  if (!['USER', 'SELLER', 'ADMIN'].includes(role)) {
    throw ApiError.badRequest('Role không hợp lệ');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role },
    select: { id: true, name: true, email: true, role: true },
  });

  sendSuccess(res, user, 'Cập nhật role thành công');
};

export const suspendUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { isActive } = req.body;

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });

  sendSuccess(res, user, isActive ? 'Mở khóa tài khoản thành công' : 'Khóa tài khoản thành công');
};

export const grantSellerPlan = async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const { planId, durationDays } = req.body;
  const parsedPlanId = Number(planId);

  if (!parsedPlanId) {
    throw ApiError.badRequest('Gói seller không hợp lệ');
  }

  const [targetUser, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.subscriptionPlan.findUnique({ where: { id: parsedPlanId } }),
  ]);

  if (!targetUser) throw ApiError.notFound('Không tìm thấy user');
  if (!plan) throw ApiError.notFound('Không tìm thấy gói seller');
  if (!plan.isActive) throw ApiError.badRequest('Gói seller đang tạm dừng');

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + Number(durationDays || plan.durationDays));

  const subscription = await prisma.$transaction(async (tx) => {
    await tx.sellerSubscription.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'EXPIRED', autoRenew: false },
    });

    const created = await tx.sellerSubscription.create({
      data: {
        userId,
        planId: parsedPlanId,
        status: 'ACTIVE',
        startDate,
        endDate,
      },
      include: { plan: true, user: { select: { id: true, name: true, email: true, role: true } } },
    });

    if (targetUser.role === 'USER') {
      await tx.user.update({ where: { id: userId }, data: { role: 'SELLER', isActive: true } });
    }

    return created;
  });

  sendSuccess(res, subscription, 'Đã cấp gói seller cho user');
};

export const deleteUser = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const currentUserId = (req as any).user?.userId;

  if (id === currentUserId) {
    throw ApiError.badRequest('Không thể xóa chính tài khoản admin đang đăng nhập');
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!target) throw ApiError.notFound('Không tìm thấy user');

  await prisma.$transaction(async (tx) => {
    const sellerProducts = await tx.product.findMany({ where: { sellerId: id }, select: { id: true } });
    const sellerProductIds = sellerProducts.map((product) => product.id);

    await tx.orderItem.updateMany({ where: { sellerId: id }, data: { sellerId: null } });

    if (sellerProductIds.length > 0) {
      await tx.orderItem.deleteMany({ where: { productId: { in: sellerProductIds } } });
      await tx.productFile.deleteMany({ where: { productId: { in: sellerProductIds } } });
      await tx.cartItem.deleteMany({ where: { productId: { in: sellerProductIds } } });
      await tx.wishlist.deleteMany({ where: { productId: { in: sellerProductIds } } });
      await tx.review.deleteMany({ where: { productId: { in: sellerProductIds } } });
      await tx.product.deleteMany({ where: { id: { in: sellerProductIds } } });
    }

    await tx.orderItem.deleteMany({ where: { order: { userId: id } } });
    await tx.order.deleteMany({ where: { userId: id } });
    await tx.cartItem.deleteMany({ where: { userId: id } });
    await tx.wishlist.deleteMany({ where: { userId: id } });
    await tx.review.deleteMany({ where: { userId: id } });
    await tx.notification.deleteMany({ where: { userId: id } });
    await tx.activityLog.deleteMany({ where: { userId: id } });
    await tx.aIChatSession.deleteMany({ where: { userId: id } });
    await tx.message.updateMany({ where: { senderId: id }, data: { senderId: null } });
    await tx.message.updateMany({ where: { receiverId: id }, data: { receiverId: null } });
    await tx.payout.deleteMany({ where: { userId: id } });
    await tx.walletTransaction.deleteMany({ where: { userId: id } });
    await tx.sellerPaymentConfig.deleteMany({ where: { userId: id } });
    await tx.sellerSubscription.deleteMany({ where: { userId: id } });
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.oAuthAccount.deleteMany({ where: { userId: id } });
    await tx.user.delete({ where: { id } });
  });

  sendSuccess(res, null, 'Đã xóa user');
};

export const getPendingProducts = async (req: Request, res: Response) => {
  const { page = '1', limit = '10' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'PENDING' },
      skip,
      take,
      include: { seller: { select: { id: true, name: true, email: true } }, category: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({ where: { status: 'PENDING' } }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, products, { page: Number(page), limit: Number(limit), total });
};

export const approveProduct = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, sellerId: true },
  });
  if (!existing) throw ApiError.notFound('Không tìm thấy sản phẩm');

  const product = await prisma.product.update({
    where: { id },
    data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: (req as any).user.userId },
  });

  const io = req.app.get('io') as SocketIOServer | undefined;
  await createAndEmit(io, {
    userId: existing.sellerId,
    title: 'Sản phẩm được duyệt',
    content: `Sản phẩm "${existing.name}" của bạn đã được admin duyệt và hiển thị trên marketplace.`,
    type: 'PRODUCT_APPROVED',
    metadata: { productId: existing.id },
  });

  if (io) {
    io.emit('product:metrics:update', {
      productId: String(existing.id),
      stock: (product as any).stock ?? 0,
      soldCount: (product as any).soldCount ?? 0,
      viewCount: (product as any).viewCount ?? 0,
      rating: 0,
      reviewsCount: 0,
    });
  }

  sendSuccess(res, product, 'Duyệt sản phẩm thành công');
};

export const approveAllProducts = async (req: Request, res: Response) => {
  const adminId = (req as any).user?.userId;

  const pendingProducts = await prisma.product.findMany({
    where: { status: 'PENDING' },
    select: { id: true, name: true, sellerId: true },
  });

  if (pendingProducts.length === 0) {
    throw ApiError.badRequest('Không có sản phẩm nào đang chờ duyệt');
  }

  const now = new Date();
  await prisma.product.updateMany({
    where: { status: 'PENDING' },
    data: { status: 'APPROVED', approvedAt: now, approvedBy: adminId },
  });

  const io = req.app.get('io') as SocketIOServer | undefined;

  await Promise.all(
    pendingProducts.map((product) =>
      createAndEmit(io, {
        userId: product.sellerId,
        title: 'Sản phẩm được duyệt',
        content: `Sản phẩm "${product.name}" của bạn đã được admin duyệt và hiển thị trên marketplace.`,
        type: 'PRODUCT_APPROVED',
        metadata: { productId: product.id },
      }),
    ),
  );

  if (io) {
    pendingProducts.forEach((product) => {
      io.emit('product:metrics:update', {
        productId: String(product.id),
        stock: 0,
        soldCount: 0,
        viewCount: 0,
        rating: 0,
        reviewsCount: 0,
      });
    });
  }

  sendSuccess(res, { count: pendingProducts.length }, `Đã duyệt ${pendingProducts.length} sản phẩm`);
};

export const rejectProduct = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { reason } = req.body;

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, name: true, sellerId: true },
  });
  if (!existing) throw ApiError.notFound('Không tìm thấy sản phẩm');

  const product = await prisma.product.update({
    where: { id },
    data: { status: 'REJECTED', metadata: { rejectionReason: reason } },
  });

  const io = req.app.get('io') as SocketIOServer | undefined;
  const rejectionMessage = reason || 'không đạt tiêu chuẩn marketplace';
  await createAndEmit(io, {
    userId: existing.sellerId,
    title: 'Sản phẩm bị từ chối',
    content: `Sản phẩm "${existing.name}" của bạn đã bị từ chối. Lý do: ${rejectionMessage}`,
    type: 'PRODUCT_REJECTED',
    metadata: { productId: existing.id, reason: rejectionMessage },
  });

  sendSuccess(res, product, 'Từ chối sản phẩm thành công');
};

export const getPlans = async (req: Request, res: Response) => {
  const plans = await prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
  sendSuccess(res, plans);
};

export const createPlan = async (req: Request, res: Response) => {
  const { name, description, price, durationDays, maxProducts, features } = req.body;
  const plan = await prisma.subscriptionPlan.create({
    data: {
      name,
      description,
      price: Number(price),
      durationDays: Number(durationDays),
      maxProducts: maxProducts != null ? Number(maxProducts) : undefined,
      features,
    },
  });
  sendSuccess(res, plan, 'Tạo gói subscription thành công', 201);
};

export const updatePlan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, description, price, durationDays, maxProducts, features, isActive } = req.body;

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (price !== undefined) data.price = price;
  if (durationDays !== undefined) data.durationDays = durationDays;
  if (maxProducts !== undefined) data.maxProducts = maxProducts;
  if (features !== undefined) data.features = features;
  if (isActive !== undefined) data.isActive = isActive;

  const plan = await prisma.subscriptionPlan.update({ where: { id }, data });
  sendSuccess(res, plan, 'Cập nhật gói subscription thành công');
};

export const deletePlan = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  await prisma.subscriptionPlan.delete({ where: { id } });
  sendSuccess(res, null, 'Xóa gói subscription thành công');
};

export const getActivityLogs = async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    }),
    prisma.activityLog.count(),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, logs, { page: Number(page), limit: Number(limit), total });
};

export const getMyNotifications = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
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

export const updateNotification = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { title, content, type } = req.body;

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Không tìm thấy thông báo');

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (content !== undefined) data.content = content;
  if (type !== undefined) data.type = type;

  const notification = await prisma.notification.update({ where: { id }, data });
  sendSuccess(res, notification, 'Cập nhật thông báo thành công');
};

export const deleteNotification = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const existing = await prisma.notification.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Không tìm thấy thông báo');

  await prisma.notification.delete({ where: { id } });
  sendSuccess(res, null, 'Xóa thông báo thành công');
};

export const sendBroadcastNotification = async (req: Request, res: Response) => {
  const { title, content, role, type = 'BROADCAST', metadata } = req.body;

  const where: Prisma.UserWhereInput = { isActive: true };
  if (role && ['USER', 'SELLER', 'ADMIN'].includes(role)) {
    where.role = role;
  }

  const users = await prisma.user.findMany({
    where,
    select: { id: true },
  });

  if (users.length === 0) {
    sendSuccess(res, { sentCount: 0 }, 'Không có người dùng nào để gửi thông báo');
    return;
  }

  const io = req.app.get('io') as SocketIOServer | undefined;
  await createAndEmitBulk(io, users.map((u) => u.id), {
    title,
    content,
    type,
    metadata: metadata || {},
  });

  sendSuccess(res, { sentCount: users.length }, `Đã gửi thông báo đến ${users.length} người dùng`);
};
