import { Request, Response } from 'express';
import { OrderStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

type OrderItemInput = {
  productId: number;
  quantity: number;
};

function getAuthContext(req: Request): { userId: number; role: Role } {
  if (!req.user) {
    throw ApiError.unauthorized('Vui lòng đăng nhập');
  }
  return { userId: req.user.userId, role: req.user.role as Role };
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = String(value ?? 'PLATFORM').toUpperCase();
  const candidate = raw;
  if (!Object.values(PaymentMethod).includes(candidate as PaymentMethod)) {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
  return candidate as PaymentMethod;
}

function parseOrderStatus(value: unknown): OrderStatus {
  const candidate = String(value ?? '');
  if (!Object.values(OrderStatus).includes(candidate as OrderStatus)) {
    throw ApiError.badRequest('Trạng thái đơn hàng không hợp lệ');
  }
  return candidate as OrderStatus;
}

function emitCartUpdated(req: Request, userId: number) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;
  io.to(`user:${userId}`).emit('cart:updated', {
    userId,
    action: 'clear',
    timestamp: Date.now(),
  });
}

function emitOrderUpdated(req: Request, orderId: number, userId: number, status: OrderStatus) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;
  io.to(`user:${userId}`).emit('order:updated', {
    orderId,
    status,
  });
}

function emitProductStockUpdates(
  req: Request,
  updates: Array<{ productId: number; stock: number }>,
) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;

  updates.forEach(({ productId, stock }) => {
    const payload = { productId: String(productId), stock };
    io.emit('product:stock:update', payload);
    io.emit('product:metrics:update', payload);
  });
}

export const createOrder = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { items } = req.body;
  const paymentMethod = parsePaymentMethod(req.body.paymentMethod);

  const pendingOrder = await prisma.order.findFirst({
    where: { userId, status: 'PENDING' },
    select: { id: true },
  });
  if (pendingOrder) {
    throw ApiError.badRequest(
      `Bạn cần thanh toán hoặc huỷ đơn hàng #${pendingOrder.id} trước khi tạo đơn mới`,
    );
  }

  if (!Array.isArray(items) || items.length === 0) {
    throw ApiError.badRequest('Danh sách sản phẩm trống');
  }

  const validatedItems: OrderItemInput[] = items.map((item) => {
    const row = item as { productId?: unknown; quantity?: unknown };
    return {
      productId: Number(row.productId),
      quantity: Math.max(1, parseInt(String(row.quantity)) || 1),
    };
  });

  if (validatedItems.some((item) => !Number.isInteger(item.productId) || item.productId <= 0)) {
    throw ApiError.badRequest('productId không hợp lệ');
  }

  const order = await prisma.$transaction(async (tx) => {
    const productIds = validatedItems.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw ApiError.badRequest('Một số sản phẩm không tồn tại');
    }

    for (const product of products) {
      if (product.status !== 'APPROVED') {
        throw ApiError.badRequest(`Sản phẩm "${product.name}" không khả dụng`);
      }
      const item = validatedItems.find(i => i.productId === product.id)!;
      if (product.stock < item.quantity) {
        throw ApiError.badRequest(`Sản phẩm "${product.name}" không đủ số lượng`);
      }
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: item.quantity } },
      });
    }

    const orderItems = products.map((product) => {
      const item = validatedItems.find(i => i.productId === product.id)!;
      const price = Number(product.price);
      const sellerFee = price * item.quantity * 0.1;
      return {
        productId: product.id,
        sellerId: product.sellerId,
        quantity: item.quantity,
        price,
        sellerPayoutAmount: price * item.quantity - sellerFee,
      };
    });

    const totalAmount = orderItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
    const platformFee = totalAmount * 0.1;

    const newOrder = await tx.order.create({
      data: {
        userId,
        totalAmount,
        platformFee,
        paymentMethod,
        status: 'PENDING',
        items: { create: orderItems },
      },
      include: {
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
      },
    });

    await tx.cartItem.deleteMany({
      where: { userId, productId: { in: productIds } },
    });

    return newOrder;
  });

  const updatedProducts = await prisma.product.findMany({
    where: { id: { in: validatedItems.map((item) => item.productId) } },
    select: { id: true, stock: true },
  });
  emitProductStockUpdates(
    req,
    updatedProducts.map((product) => ({ productId: product.id, stock: product.stock })),
  );
  emitCartUpdated(req, userId);
  emitOrderUpdated(req, order.id, order.userId, order.status);
  sendSuccess(res, order, 'Tạo đơn hàng thành công', 201);
};

export const getOrders = async (req: Request, res: Response) => {
  const { userId, role: userRole } = getAuthContext(req);
  const { page = '1', limit = '10', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.OrderWhereInput = {};
  if (userRole === 'SELLER') {
    where.items = { some: { sellerId: userId } };
  } else {
    where.userId = userId;
  }
  if (status) where.status = parseOrderStatus(status);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, images: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, orders, { page: Number(page), limit: Number(limit), total });
};

export const getOrder = async (req: Request, res: Response) => {
  const { userId, role: userRole } = getAuthContext(req);
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw ApiError.badRequest('ID đơn hàng không hợp lệ');
  }

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, description: true, images: true, type: true, metadata: true } },
          seller: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');

  const isOwner = order.userId === userId || order.items.some((i) => i.sellerId === userId);
  if (!isOwner && userRole !== 'ADMIN') {
    throw ApiError.forbidden('Bạn không có quyền xem đơn hàng này');
  }

  sendSuccess(res, order);
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const { userId, role: userRole } = getAuthContext(req);
  const id = Number(req.params.id);
  const status = parseOrderStatus(req.body.status);

  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');

  const isSeller = order.items.some(item => item.sellerId === userId);
  if (userRole !== 'ADMIN' && order.userId !== userId && !isSeller) {
    throw ApiError.forbidden('Bạn không có quyền cập nhật đơn hàng này');
  }

  const validTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
    PENDING: ['CONFIRMED', 'CANCELLED', 'FAILED'],
    CONFIRMED: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['SHIPPED', 'CANCELLED'],
    SHIPPED: ['DELIVERED'],
    DELIVERED: ['REFUNDED'],
    PAID: ['REFUNDED'],
  };

  if (!validTransitions[order.status]?.includes(status)) {
    throw ApiError.badRequest(`Không thể chuyển từ ${order.status} sang ${status}`);
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { status },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { product: true } },
    },
  });

  await prisma.notification.create({
    data: {
      userId: order.userId,
      title: 'Cập nhật đơn hàng',
      content: `Đơn hàng #${id} đã được cập nhật sang trạng thái ${status}`,
      type: 'ORDER',
      metadata: { orderId: id },
    },
  });

  emitOrderUpdated(req, updated.id, updated.userId, updated.status);
  sendSuccess(res, updated, 'Cập nhật trạng thái thành công');
};

export const cancelOrder = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const id = Number(req.params.id);

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');

  if (order.userId !== userId) throw ApiError.forbidden('Bạn không có quyền hủy đơn hàng này');
  if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
    throw ApiError.badRequest('Không thể hủy đơn hàng ở trạng thái này');
  }

  const cancelledOrder = await prisma.order.update({
    where: { id },
    data: { status: 'CANCELLED' },
    select: { id: true, userId: true, status: true },
  });

  const orderItems = await prisma.orderItem.findMany({ where: { orderId: id } });
  for (const item of orderItems) {
    await prisma.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
  }

  const restoredProducts = await prisma.product.findMany({
    where: { id: { in: orderItems.map((item) => item.productId) } },
    select: { id: true, stock: true },
  });
  emitProductStockUpdates(
    req,
    restoredProducts.map((product) => ({ productId: product.id, stock: product.stock })),
  );
  emitOrderUpdated(req, cancelledOrder.id, cancelledOrder.userId, cancelledOrder.status);

  sendSuccess(res, null, 'Hủy đơn hàng thành công');
};

export const getSellerOrders = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { page = '1', limit = '10', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.OrderWhereInput = {
    items: { some: { sellerId: userId } },
  };
  if (status) where.status = parseOrderStatus(status);

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: {
          where: { sellerId: userId },
          include: { product: { select: { id: true, name: true, images: true } } },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, orders, { page: Number(page), limit: Number(limit), total });
};
