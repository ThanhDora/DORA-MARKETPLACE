import { Request, Response } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

const parsePositiveInt = (value: unknown, message: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw ApiError.badRequest(message);
  }
  return parsed;
};

function emitCartUpdated(req: Request, userId: number, payload: Record<string, unknown> = {}) {
  const io = req.app.get('io') as SocketIOServer | undefined;
  if (!io) return;
  io.to(`user:${userId}`).emit('cart:updated', {
    userId,
    timestamp: Date.now(),
    ...payload,
  });
}

export const getCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: {
      product: {
        include: {
          seller: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const total = cartItems.reduce((sum: number, item: any) => {
    return sum + Number(item.product.price) * item.quantity;
  }, 0);

  sendSuccess(res, { items: cartItems, total });
};

export const addToCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId, quantity = 1 } = req.body;
  const productIdNumber = parsePositiveInt(productId, 'ID sản phẩm không hợp lệ');
  const quantityNumber = parsePositiveInt(quantity, 'Số lượng không hợp lệ');

  const product = await prisma.product.findUnique({
    where: { id: productIdNumber },
    include: { seller: true },
  });

  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  if (product.status !== 'APPROVED') throw ApiError.badRequest('Sản phẩm không khả dụng');
  if (product.stock < quantityNumber) throw ApiError.badRequest('Sản phẩm không đủ số lượng');

  const existing = await prisma.cartItem.findFirst({
    where: { userId, productId: productIdNumber },
  });

  if (existing) {
    const nextQuantity = existing.quantity + quantityNumber;
    if (product.stock < nextQuantity) throw ApiError.badRequest('Sản phẩm không đủ số lượng');

    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: nextQuantity },
      include: { product: true },
    });
    emitCartUpdated(req, userId, { action: 'update', itemId: updated.id, quantity: nextQuantity });
    return sendSuccess(res, updated, 'Cập nhật giỏ hàng thành công');
  }

  const cartItem = await prisma.cartItem.create({
    data: { userId, productId: productIdNumber, quantity: quantityNumber },
    include: { product: true },
  });

  emitCartUpdated(req, userId, { action: 'add', itemId: cartItem.id, quantity: cartItem.quantity });
  sendSuccess(res, cartItem, 'Thêm vào giỏ hàng thành công', 201);
};

export const updateCartItem = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = parsePositiveInt(req.params.id, 'ID giỏ hàng không hợp lệ');
  const quantity = parsePositiveInt(req.body.quantity, 'Số lượng không hợp lệ');

  const cartItem = await prisma.cartItem.findFirst({
    where: { id, userId },
    include: { product: true },
  });

  if (!cartItem) throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');
  if (cartItem.product.stock < quantity) throw ApiError.badRequest('Sản phẩm không đủ số lượng');

  const updated = await prisma.cartItem.update({
    where: { id },
    data: { quantity },
    include: { product: true },
  });

  emitCartUpdated(req, userId, { action: 'update', itemId: updated.id, quantity: updated.quantity });
  sendSuccess(res, updated, 'Cập nhật giỏ hàng thành công');
};

export const removeFromCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = parsePositiveInt(req.params.id, 'ID giỏ hàng không hợp lệ');

  const cartItem = await prisma.cartItem.findFirst({
    where: { id, userId },
  });

  if (!cartItem) throw ApiError.notFound('Không tìm thấy sản phẩm trong giỏ hàng');

  await prisma.cartItem.delete({ where: { id } });
  emitCartUpdated(req, userId, { action: 'remove', itemId: id });
  sendSuccess(res, null, 'Xóa sản phẩm khỏi giỏ hàng thành công');
};

export const clearCart = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  await prisma.cartItem.deleteMany({ where: { userId } });
  emitCartUpdated(req, userId, { action: 'clear' });
  sendSuccess(res, null, 'Xóa toàn bộ giỏ hàng thành công');
};
