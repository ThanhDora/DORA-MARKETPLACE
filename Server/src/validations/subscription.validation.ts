import { z } from 'zod';

export const createPlanSchema = z.object({
  name: z.string({ required_error: 'Tên gói là bắt buộc' }).min(1, 'Tên gói là bắt buộc').max(100),
  description: z.string().optional(),
  price: z.number({ required_error: 'Giá là bắt buộc', invalid_type_error: 'Giá phải là số' }).positive('Giá phải lớn hơn 0'),
  durationDays: z.number({ required_error: 'Thời hạn là bắt buộc', invalid_type_error: 'Thời hạn phải là số' }).int().positive('Thời hạn phải lớn hơn 0'),
  maxProducts: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
});

export const updatePlanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  durationDays: z.number().int().positive().optional(),
  maxProducts: z.number().int().min(0).optional(),
  features: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
