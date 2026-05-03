import { z } from 'zod';

export const createOrderSchema = z.object({
  items: z.array(z.object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().positive().optional().default(1),
  })).min(1, 'Phải có ít nhất 1 sản phẩm'),
  paymentMethod: z.enum(['PLATFORM']).optional().default('PLATFORM'),
});

export const updateOrderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PAID', 'FAILED']),
});

export const orderQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PAID', 'FAILED']).optional(),
  sellerId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'totalAmount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const orderIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createPaymentSchema = z.object({
  orderId: z.coerce.number().int().positive('ID đơn hàng không hợp lệ'),
  method: z.enum(['PLATFORM']),
});

export const paymentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  orderId: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED', 'PAID', 'FAILED']).optional(),
});

export const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'ID gói subscription là bắt buộc'),
  paymentMethod: z.enum(['PLATFORM', 'MOMO', 'SEPAY', 'PAYPAL', 'BANK_TRANSFER']).optional().default('PLATFORM'),
});

export const subscriptionQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED']).optional(),
});

export const createPayoutSchema = z.object({
  amount: z.number().positive('Số tiền phải lớn hơn 0'),
  bankAccount: z.string().min(1, 'Số tài khoản là bắt buộc'),
  bankName: z.string().min(1, 'Tên ngân hàng là bắt buộc'),
  accountHolder: z.string().min(1, 'Tên chủ tài khoản là bắt buộc'),
});

export const payoutQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']).optional(),
  userId: z.string().optional(),
});

export const createPaymentConfigSchema = z.object({
  method: z.enum(['MOMO', 'SEPAY', 'PAYPAL', 'BANK_TRANSFER']),
  config: z.record(z.any()),
});

export const updatePaymentConfigSchema = z.object({
  config: z.record(z.any()).optional(),
  isActive: z.boolean().optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;
export type OrderQueryInput = z.infer<typeof orderQuerySchema>;
export type OrderIdParamInput = z.infer<typeof orderIdParamSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type PaymentQueryInput = z.infer<typeof paymentQuerySchema>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type SubscriptionQueryInput = z.infer<typeof subscriptionQuerySchema>;
export type CreatePayoutInput = z.infer<typeof createPayoutSchema>;
export type PayoutQueryInput = z.infer<typeof payoutQuerySchema>;
export type CreatePaymentConfigInput = z.infer<typeof createPaymentConfigSchema>;
export type UpdatePaymentConfigInput = z.infer<typeof updatePaymentConfigSchema>;
