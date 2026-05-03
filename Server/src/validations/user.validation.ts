import { z } from 'zod';

export const userOrderQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PAID', 'FAILED']).optional(),
});

export const notificationQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  isRead: z.enum(['true', 'false']).optional(),
});

export const notificationIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1, 'Tiêu đề là bắt buộc').max(200),
  content: z.string().min(1, 'Nội dung là bắt buộc').max(2000),
  role: z.enum(['USER', 'SELLER', 'ADMIN']).optional(),
  type: z.string().optional().default('BROADCAST'),
  metadata: z.record(z.any()).optional(),
});

export const updateNotificationSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(2000).optional(),
  type: z.string().optional(),
});
