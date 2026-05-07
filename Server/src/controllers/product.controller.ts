import { Request, Response } from 'express';
import { Prisma, ProductType } from '@prisma/client';
import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';
import { createAndEmitBulk } from '../services/notification.service.js';
import { env } from '../config/env.js';

const generateSlug = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

function buildSearchConditions(search: string): Prisma.ProductWhereInput[] {
  const keywords = search.trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  return keywords.map((keyword) => {
    const cleanKeyword = keyword.replace(/[^a-zA-Z0-9\u00c0-\u1ef9]/g, '');
    const conditions: Prisma.ProductWhereInput[] = [
      { name: { contains: keyword, mode: 'insensitive' } },
      { description: { contains: keyword, mode: 'insensitive' } },
    ];
    if (cleanKeyword && cleanKeyword !== keyword) {
      conditions.push(
        { name: { contains: cleanKeyword, mode: 'insensitive' } },
        { description: { contains: cleanKeyword, mode: 'insensitive' } },
      );
    }
    return { OR: conditions };
  });
}

export const listProducts = async (req: Request, res: Response) => {
  const { page = '1', limit = '12', categoryId, sellerId, search, minPrice, maxPrice, status, type, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.ProductWhereInput = { status: 'APPROVED' };
  if (categoryId) where.categoryId = Number(categoryId);
  if (sellerId) where.sellerId = Number(sellerId);
  if (search) {
    const searchConditions = buildSearchConditions(String(search));
    if (searchConditions.length > 0) {
      where.AND = searchConditions;
    }
  }
  if (minPrice !== undefined && minPrice !== '' || maxPrice !== undefined && maxPrice !== '') {
    where.price = {};
    if (minPrice !== undefined && minPrice !== '') (where.price as any).gte = Number(minPrice);
    if (maxPrice !== undefined && maxPrice !== '') (where.price as any).lte = Number(maxPrice);
  }
  if (status) where.status = String(status) as any;
  if (type) where.type = String(type) as any;

  const orderBy: any = {};
  orderBy[String(sortBy)] = sortOrder;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        seller: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { reviews: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, products, { page: Number(page), limit: Number(limit), total });
};

export const getProduct = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw ApiError.badRequest('ID sản phẩm không hợp lệ');
  }

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      seller: { select: { id: true, name: true, email: true } },
      category: true,
      files: true,
      reviews: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true } } },
      },
      _count: { select: { reviews: true, orderItems: true } },
    },
  });

  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');

  const reviews = await prisma.review.aggregate({
    where: { productId: id },
    _avg: { rating: true },
  });

  sendSuccess(res, { ...product, averageRating: reviews._avg.rating || 0 });
};

export const trackProductView = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw ApiError.badRequest('ID sản phẩm không hợp lệ');
  }

  const updated = await prisma.product.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    include: {
      _count: { select: { reviews: true } },
    },
  });

  const avgRating = await prisma.review.aggregate({
    where: { productId: id },
    _avg: { rating: true },
  });

  const payload = {
    productId: String(updated.id),
    viewCount: updated.viewCount,
    soldCount: updated.soldCount,
    stock: updated.stock,
    rating: Number(avgRating._avg.rating || 0),
    reviewsCount: updated._count.reviews,
  };

  const io = req.app.get('io') as SocketIOServer | undefined;
  if (io) {
    io.emit('product:metrics:update', payload);
  }

  sendSuccess(res, payload, 'Đã ghi nhận lượt xem');
};

export const createProduct = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const userRole = (req as any).user.role as string;
  const { name, description, price, categoryId, type, files, stock, images, metadata } = req.body;

  const parsedPrice = Number(price);
  if (isNaN(parsedPrice) || parsedPrice <= 0) throw ApiError.badRequest('Giá sản phẩm không hợp lệ');

  const validTypes = ['ACCOUNT', 'KEY', 'FILE'];
  if (!validTypes.includes(type)) throw ApiError.badRequest('Loại sản phẩm không hợp lệ');

  const parsedCategoryId = categoryId ? Number(categoryId) : undefined;
  if (categoryId && (!parsedCategoryId || Number.isNaN(parsedCategoryId))) {
    throw ApiError.badRequest('Danh mục không hợp lệ');
  }

  if (parsedCategoryId) {
    const category = await prisma.category.findFirst({ where: { id: parsedCategoryId, isActive: true } });
    if (!category) {
      throw ApiError.badRequest('Danh mục không tồn tại hoặc đã bị vô hiệu hóa');
    }
  }

  let subscription: { plan: { maxProducts: number | null } } | null = null;
  if (userRole !== 'ADMIN') {
    subscription = await prisma.sellerSubscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      include: { plan: true },
    });
  }

  if (userRole !== 'ADMIN' && !subscription) {
    throw ApiError.forbidden('Bạn cần có subscription để đăng sản phẩm');
  }

  const productCount = await prisma.product.count({ where: { sellerId: userId, status: { notIn: ['REJECTED', 'DELETED'] } } });
  if (subscription?.plan.maxProducts && productCount >= subscription.plan.maxProducts) {
    throw ApiError.badRequest(`Bạn đã đạt giới hạn ${subscription.plan.maxProducts} sản phẩm`);
  }

  const normalizedName = String(name).trim();
  let slug = generateSlug(normalizedName);
  if (!slug) {
    slug = `product-${Date.now()}`;
  }
  const existing = await prisma.product.findFirst({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  const product = await prisma.product.create({
    data: {
      name: normalizedName,
      slug,
      description: String(description),
      price: new Prisma.Decimal(parsedPrice),
      categoryId: parsedCategoryId,
      sellerId: userId,
      type: type as ProductType,
      stock: type === 'ACCOUNT' ? 1 : Number(stock),
      images: images || [],
      metadata: metadata || {},
      status: 'PENDING',
    } as any,
    include: {
      seller: { select: { id: true, name: true } },
      category: true,
    },
  });

  if (files && files.length > 0) {
    await prisma.productFile.createMany({
      data: files.map((f: any) => ({ productId: product.id, fileName: f.fileName, fileSize: f.fileSize, mimeType: f.mimeType, downloadUrl: f.downloadUrl })),
    });
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true },
  });

  if (admins.length > 0) {
    const io = req.app.get('io') as SocketIOServer | undefined;
    await createAndEmitBulk(io, admins.map((a) => a.id), {
      title: 'Sản phẩm mới cần kiểm duyệt',
      content: `Sản phẩm "${normalizedName}" vừa được tạo và đang chờ được duyệt.`,
      type: 'PRODUCT_PENDING',
      metadata: { productId: product.id, sellerId: userId },
    });
  }

  sendSuccess(res, product, 'Tạo sản phẩm thành công', 201);
};

export const uploadProductImages = async (req: Request, res: Response) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) {
    throw ApiError.badRequest('Vui lòng chọn ít nhất 1 ảnh');
  }

  const urls = files.map((file) => `${env.BACKEND_URL}/api/uploads/images/${file.filename}`);
  sendSuccess(res, { urls }, 'Tải ảnh thành công');
};

export const updateProduct = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);
  const { name, description, price, categoryId, stock, images, metadata, status } = req.body;

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  if (product.sellerId !== userId) throw ApiError.forbidden('Bạn không có quyền sửa sản phẩm này');

  const updateData: any = {};
  if (name) {
    updateData.name = name;
    let slug = generateSlug(name);
    const existing = await prisma.product.findFirst({ where: { slug, NOT: { id } } });
    if (existing) slug = `${slug}-${Date.now()}`;
    updateData.slug = slug;
  }
  if (description !== undefined) updateData.description = description;
  if (price !== undefined) updateData.price = Number(price);
  if (categoryId) updateData.categoryId = categoryId;
  if (stock !== undefined) updateData.stock = Number(stock);
  if (images) updateData.images = images;
  if (metadata) updateData.metadata = metadata;
  if (status && req.user?.role === 'ADMIN') updateData.status = status;

  const updated = await prisma.product.update({ where: { id }, data: updateData });

  const io = req.app.get('io') as import('socket.io').Server | undefined;
  if (io) {
    io.emit('product:updated', {
      productId: String(updated.id),
      name: updated.name,
      price: Number(updated.price),
      stock: updated.stock,
      images: updated.images,
      description: updated.description,
      slug: updated.slug,
    });
  }

  sendSuccess(res, updated, 'Cập nhật sản phẩm thành công');
};

export const deleteProduct = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const id = Number(req.params.id);

  if (!id || isNaN(id)) {
    throw ApiError.badRequest('ID sản phẩm không hợp lệ');
  }

  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  if (product.sellerId !== userId && (req as any).user.role !== 'ADMIN') {
    throw ApiError.forbidden('Bạn không có quyền xóa sản phẩm này');
  }

  await prisma.product.delete({ where: { id } });
  sendSuccess(res, null, 'Xóa sản phẩm thành công');
};

export const listSellerProducts = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { page = '1', limit = '12', status } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.ProductWhereInput = { sellerId: userId };
  if (status) where.status = String(status) as any;

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { category: true, _count: { select: { reviews: true, orderItems: true } } },
    }),
    prisma.product.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, products, { page: Number(page), limit: Number(limit), total });
};

export const suggestProducts = async (req: Request, res: Response) => {
  const { q = '', limit = '8' } = req.query;
  const search = String(q).trim();
  if (!search || search.length < 1) {
    return sendSuccess(res, []);
  }

  const searchConditions = buildSearchConditions(search);
  const products = await prisma.product.findMany({
    where: {
      status: 'APPROVED',
      ...(searchConditions.length > 0 ? { AND: searchConditions } : {}),
    },
    select: { id: true, name: true, price: true, type: true, images: true, slug: true },
    take: Number(limit),
    orderBy: { soldCount: 'desc' },
  });

  const normalized = products.map((p) => ({
    ...p,
    images: parseJsonArray(p.images),
  }));

  sendSuccess(res, normalized);
};

function parseJsonArray(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {}
  }
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

export { prisma };
