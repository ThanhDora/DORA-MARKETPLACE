import { Request, Response } from 'express';
import { OrderStatus, PaymentMethod, Prisma, Role } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import {
  createMomoPayment,
  createSePayPayment,
  createPayPalPayment,
  verifyMomoSignature,
  verifySePaySignature,
  deliverOrder,
} from '../services/payment.service.js';

function getAuthContext(req: Request): { userId: number; role: Role } {
  if (!req.user) {
    throw ApiError.unauthorized('Vui lòng đăng nhập');
  }
  return { userId: req.user.userId, role: req.user.role as Role };
}

function parsePaymentMethod(value: unknown): PaymentMethod {
  const raw = String(value ?? '').toUpperCase();
  if (!Object.values(PaymentMethod).includes(raw as PaymentMethod)) {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
  return raw as PaymentMethod;
}

function emitOrderUpdated(io: SocketIOServer | undefined, userId: number, orderId: number, status: OrderStatus) {
  if (!io) return;
  io.to(`user:${userId}`).emit('order:updated', {
    orderId,
    status,
  });
}

async function emitLatestOrderStatus(orderId: number, io: SocketIOServer | undefined) {
  if (!io) return;
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, status: true },
  });
  if (!order) return;
  emitOrderUpdated(io, order.userId, order.id, order.status);
}

async function deliverOrderAndEmitNotification(orderId: number, io: SocketIOServer | undefined) {
  const delivered = await deliverOrder(orderId);
  if (!io || !delivered) return;
  io.to(`user:${delivered.userId}`).emit('notification:new', {
    id: delivered.notification.id,
    title: delivered.notification.title,
    content: delivered.notification.content,
    type: delivered.notification.type,
    createdAt: delivered.notification.createdAt.toISOString(),
  });
}

async function markOrderPaidAndEmit(orderId: number, io?: SocketIOServer) {
  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw ApiError.notFound('Không tìm thấy đơn hàng');
    }

    if (order.status === 'PAID' || order.status === 'DELIVERING' || order.status === 'DELIVERED') {
      return { orderId: order.id, userId: order.userId, items: [], changed: false };
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: 'PAID' },
    });

    for (const item of order.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { soldCount: { increment: item.quantity } },
      });
    }

    // Credit sellers
    const sellerRevenue = new Map<number, number>();
    for (const item of order.items) {
      if (!item.sellerId) continue;
      sellerRevenue.set(item.sellerId, (sellerRevenue.get(item.sellerId) || 0) + Number(item.sellerPayoutAmount));
    }
    for (const [sellerId, amount] of sellerRevenue) {
      await tx.user.update({
        where: { id: sellerId },
        data: { balance: { increment: amount } },
      });
      await tx.walletTransaction.create({
        data: {
          userId: sellerId,
          amount,
          type: 'SELLER_REVENUE',
          status: 'COMPLETED',
          referenceId: String(orderId),
          description: `Doanh thu từ đơn hàng #${orderId}`,
        },
      });
      await tx.notification.create({
        data: {
          userId: sellerId,
          title: 'Đơn hàng mới',
          content: `Bạn có đơn hàng #${orderId} mới, doanh thu ${amount.toLocaleString('vi-VN')} VND đã được cộng vào ví.`,
          type: 'ORDER',
          metadata: { orderId, amount },
        },
      });
    }

    return { orderId: order.id, userId: order.userId, items: order.items, changed: true };
  });

  if (!io || !result.changed) return;

  emitOrderUpdated(io, result.userId, result.orderId, 'PAID');

  const productIds = [...new Set(result.items.map((item) => item.productId))];
  if (productIds.length === 0) return;

  const updatedProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, soldCount: true, stock: true },
  });

  updatedProducts.forEach((product) => {
    io.emit('product:metrics:update', {
      productId: String(product.id),
      soldCount: product.soldCount,
      stock: product.stock,
    });
  });
}

export const getPaymentMethods = async (req: Request, res: Response) => {
  sendSuccess(res, [
    { id: 'PLATFORM', name: 'Số dư ví', icon: 'wallet' },
    { id: 'MOMO', name: 'MoMo', icon: 'smartphone' },
    { id: 'SEPAY', name: 'SePay', icon: 'credit-card' },
    { id: 'PAYPAL', name: 'PayPal', icon: 'paypal' },
    { id: 'BANK_TRANSFER', name: 'Chuyển khoản ngân hàng', icon: 'bank' },
  ]);
};

export const createPayment = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { orderId } = req.body;
  const method = parsePaymentMethod(req.body.method);

  const orderIdNum = Number(orderId);
  const order = await prisma.order.findUnique({
    where: { id: orderIdNum },
    include: {
      items: { include: { product: true } },
    },
  });

  if (!order) throw ApiError.notFound('Không tìm thấy đơn hàng');
  if (order.userId !== userId) throw ApiError.forbidden('Bạn không có quyền thanh toán đơn hàng này');
  if (order.status !== 'PENDING') throw ApiError.badRequest('Đơn hàng không ở trạng thái chờ thanh toán');

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

  if (method === 'MOMO') {
    const result = await createMomoPayment(
      orderIdNum,
      Number(order.totalAmount),
      `${frontendUrl}/order/${orderIdNum}/success`,
      `${backendUrl}/api/payments/webhook/momo`
    );

    sendSuccess(res, { paymentUrl: result.endpoint, method: 'POST', body: result.body });
  } else if (method === 'SEPAY') {
    const result = await createSePayPayment(
      orderIdNum,
      Number(order.totalAmount),
      `${frontendUrl}/order/${orderIdNum}/success`,
      `${backendUrl}/api/payments/webhook/sepay`,
    );

    sendSuccess(res, {
      paymentUrl: result.paymentUrl,
      method: result.method,
      body: result.body,
      orderId: result.orderId,
    });
  } else if (method === 'PAYPAL') {
    const result = await createPayPalPayment(
      orderIdNum,
      Number(order.totalAmount),
      `${frontendUrl}/order/${orderIdNum}/success`
    );

    sendSuccess(res, { paymentUrl: result.approvalUrl });
  } else if (method === PaymentMethod.PLATFORM) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user || Number(user.balance) < Number(order.totalAmount)) {
      throw ApiError.badRequest('Số dư ví không đủ. Vui lòng nạp thêm tiền.');
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: order.totalAmount } },
      });

      await tx.walletTransaction.create({
        data: {
          userId,
          amount: order.totalAmount,
          type: 'PAYMENT',
          status: 'COMPLETED',
          paymentMethod: PaymentMethod.PLATFORM,
          referenceId: String(orderIdNum),
          description: `Thanh toán đơn hàng #${orderIdNum}`,
        },
      });

      await tx.order.update({
        where: { id: orderIdNum },
        data: { paymentMethod: method, status: 'PAID' },
      });

      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        });
      }

      // Credit sellers
      const sellerRevenue = new Map<number, number>();
      for (const item of order.items) {
        if (!item.sellerId) continue;
        sellerRevenue.set(item.sellerId, (sellerRevenue.get(item.sellerId) || 0) + Number(item.sellerPayoutAmount));
      }
      for (const [sellerId, amount] of sellerRevenue) {
        await tx.user.update({
          where: { id: sellerId },
          data: { balance: { increment: amount } },
        });
        await tx.walletTransaction.create({
          data: {
            userId: sellerId,
            amount,
            type: 'SELLER_REVENUE',
            status: 'COMPLETED',
            paymentMethod: PaymentMethod.PLATFORM,
            referenceId: String(orderIdNum),
            description: `Doanh thu từ đơn hàng #${orderIdNum}`,
          },
        });
        await tx.notification.create({
          data: {
            userId: sellerId,
            title: 'Đơn hàng mới',
            content: `Bạn có đơn hàng #${orderIdNum} mới, doanh thu ${amount.toLocaleString('vi-VN')} VND đã được cộng vào ví.`,
            type: 'ORDER',
            metadata: { orderId: orderIdNum, amount },
          },
        });
      }
    });

    const io = req.app.get('io') as SocketIOServer | undefined;
    emitOrderUpdated(io, userId, orderIdNum, 'PAID');

    const productIds = [...new Set(order.items.map((item) => item.productId))];
    if (productIds.length > 0 && io) {
      const updatedProducts = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, soldCount: true, stock: true },
      });
      updatedProducts.forEach((product) => {
        io.emit('product:metrics:update', {
          productId: String(product.id),
          soldCount: product.soldCount,
          stock: product.stock,
        });
      });
    }

    await deliverOrderAndEmitNotification(orderIdNum, io);
    await emitLatestOrderStatus(orderIdNum, io);

    sendSuccess(res, { orderId: orderIdNum, status: 'PAID' }, 'Thanh toán bằng số dư ví thành công');
  } else if (method === PaymentMethod.BANK_TRANSFER) {
    await prisma.order.update({
      where: { id: orderIdNum },
      data: { paymentMethod: method },
    });

    sendSuccess(res, { orderId: orderIdNum, status: 'PENDING' }, 'Đơn hàng đang chờ xác nhận thanh toán');
  } else {
    throw ApiError.badRequest('Phương thức thanh toán không hợp lệ');
  }
};

export const momoWebhook = async (req: Request, res: Response) => {
  try {
    const { orderId, resultCode } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    if (!verifyMomoSignature(req.body)) {
      return res.status(400).json({ success: false, message: 'Invalid signature' });
    }

    const orderIdNum = Number(orderId);
    const io = req.app.get('io') as SocketIOServer | undefined;

    if (resultCode === 0) {
      await markOrderPaidAndEmit(orderIdNum, io);
      await deliverOrderAndEmitNotification(orderIdNum, io);
      await emitLatestOrderStatus(orderIdNum, io);
    } else {
      const failedOrder = await prisma.order.update({
        where: { id: orderIdNum },
        data: { status: 'FAILED' },
        select: { id: true, userId: true, status: true },
      });
      emitOrderUpdated(io, failedOrder.userId, failedOrder.id, failedOrder.status);
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Webhook error' });
  }
};


export const sepayReturn = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  try {
    const sepayParams = ({
      ...((req.query as Record<string, unknown>) ?? {}),
      ...((req.body as Record<string, unknown>) ?? {}),
    }) as Record<string, string>;

    const secretKey = process.env.SEPAY_SECRET_KEY;

    if (!secretKey || !verifySePaySignature(sepayParams, secretKey)) {
      return res.redirect(`${frontendUrl}/payment/failed?error=invalid_signature`);
    }

    const orderIdStr = sepayParams.order_invoice_number;
    if (!orderIdStr) {
      return res.redirect(`${frontendUrl}/payment/failed?error=invalid_order`);
    }

    const orderIdNum = Number(orderIdStr);
    const io = req.app.get('io') as SocketIOServer | undefined;

    await markOrderPaidAndEmit(orderIdNum, io);
    await deliverOrderAndEmitNotification(orderIdNum, io);
    await emitLatestOrderStatus(orderIdNum, io);

    res.redirect(`${frontendUrl}/order/${orderIdNum}/success`);
  } catch {
    res.redirect(`${frontendUrl}/payment/failed?error=webhook_error`);
  }
};

export const paypalWebhook = async (req: Request, res: Response) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid orderId' });
    }

    const orderIdNum = Number(orderId);
    const io = req.app.get('io') as SocketIOServer | undefined;

    if (status === 'COMPLETED') {
      await markOrderPaidAndEmit(orderIdNum, io);
      await deliverOrderAndEmitNotification(orderIdNum, io);
      await emitLatestOrderStatus(orderIdNum, io);
    }

    res.status(200).json({ success: true });
  } catch {
    res.status(500).json({ success: false, message: 'Webhook error' });
  }
};

export const getPaymentHistory = async (req: Request, res: Response) => {
  const { userId } = getAuthContext(req);
  const { page = '1', limit = '10', orderId, status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.OrderWhereInput = { userId };
  if (orderId !== undefined) {
    where.id = Number(orderId);
  }
  if (status !== undefined) {
    where.status = String(status) as OrderStatus;
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        totalAmount: true,
        paymentMethod: true,
        status: true,
        createdAt: true,
        items: {
          select: {
            id: true,
            price: true,
            quantity: true,
            product: { select: { id: true, name: true, images: true } },
          },
        },
      },
    }),
    prisma.order.count({ where }),
  ]);

  sendList(res, orders, { page: Number(page), limit: Number(limit), total });
};
