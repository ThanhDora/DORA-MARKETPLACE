import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().min(1, 'Tên sản phẩm là bắt buộc').max(200),
  description: z.string().optional(),
  price: z.number().positive('Giá phải lớn hơn 0'),
  categoryId: z.number().int().positive('Danh mục là bắt buộc'),
  type: z.enum(['ACCOUNT', 'KEY', 'FILE']).optional().default('ACCOUNT'),
  stock: z.number().int().min(0).optional(),
  images: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  categoryId: z.number().int().positive().optional(),
  stock: z.number().int().min(0).optional(),
  images: z.array(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DELETED']).optional(),
});

export const productQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(12),
  categoryId: z.string().optional(),
  sellerId: z.string().optional(),
  search: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'INACTIVE', 'DELETED']).optional(),
  type: z.enum(['ACCOUNT', 'KEY', 'FILE']).optional(),
  sortBy: z.enum(['createdAt', 'price', 'name', 'viewCount', 'soldCount']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Tên danh mục là bắt buộc').max(100),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const addToCartSchema = z.object({
  productId: z.string().min(1, 'ID sản phẩm là bắt buộc'),
  quantity: z.number().int().positive().optional().default(1),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive('Số lượng phải lớn hơn 0'),
});

export const addToWishlistSchema = z.object({
  productId: z.string().min(1, 'ID sản phẩm là bắt buộc'),
});

export const createReviewSchema = z.object({
  productId: z.string().min(1, 'ID sản phẩm là bắt buộc'),
  rating: z.number().int().min(1).max(5, 'Rating từ 1-5'),
  content: z.string().optional(),
});

export const reviewQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  productId: z.string().optional(),
  sortBy: z.enum(['createdAt', 'rating']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().optional(),
  avatar: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional(),
  address: z.string().max(300).optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  search: z.string().optional(),
  role: z.enum(['USER', 'SELLER', 'ADMIN']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type AddToCartInput = z.infer<typeof addToCartSchema>;
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;
export type AddToWishlistInput = z.infer<typeof addToWishlistSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
export type ReviewQueryInput = z.infer<typeof reviewQuerySchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
