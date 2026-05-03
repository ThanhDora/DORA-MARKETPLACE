import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { logger } from '../config/logger.js';

const CLEANUP_INTERVAL_MS = 60_000;
const ORDER_TIMEOUT_MS = 5 * 60_000;

export function startOrderCleanupJob(io: SocketIOServer) {
  logger.info(`Order cleanup job started (interval: ${CLEANUP_INTERVAL_MS / 1000}s, timeout: ${ORDER_TIMEOUT_MS / 1000}s)`);

  const run = async () => {
    try {
      const cutoff = new Date(Date.now() - ORDER_TIMEOUT_MS);

      const expiredOrders = await prisma.order.findMany({
        where: {
          status: 'PENDING',
          createdAt: { lt: cutoff },
        },
        select: { id: true, userId: true },
      });

      if (expiredOrders.length === 0) return;

      for (const order of expiredOrders) {
        try {
          await prisma.$transaction(async (tx) => {
            const current = await tx.order.findUnique({
              where: { id: order.id },
              select: { id: true, status: true },
            });

            if (!current || current.status !== 'PENDING') return;

            await tx.order.update({
              where: { id: order.id },
              data: { status: 'CANCELLED' },
            });

            const items = await tx.orderItem.findMany({
              where: { orderId: order.id },
              select: { productId: true, quantity: true },
            });

            for (const item of items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }

            await tx.notification.create({
              data: {
                userId: order.userId,
                title: 'Đơn hàng đã bị huỷ',
                content: `Đơn hàng #${order.id} đã bị huỷ do quá thời hạn thanh toán (5 phút).`,
                type: 'ORDER',
                metadata: { orderId: order.id, reason: 'timeout' },
              },
            });
          });

          io.to(`user:${order.userId}`).emit('order:updated', {
            orderId: order.id,
            status: 'CANCELLED',
          });

          logger.info(`Order #${order.id} auto-cancelled (timeout)`);
        } catch (err) {
          logger.error(`Error cleaning up order #${order.id}: ${err}`);
        }
      }
    } catch (err) {
      logger.error(`Order cleanup job error: ${err}`);
    }
  };

  run();

  const timer = setInterval(run, CLEANUP_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    logger.info('Order cleanup job stopped');
  };
}
