import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

export const getWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { page = '1', limit = '12' } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const [items, total] = await Promise.all([
    prisma.wishlist.findMany({
      where: { userId },
      skip,
      take,
      include: {
        product: {
          include: {
            seller: { select: { id: true, name: true } },
            category: { select: { id: true, name: true } },
            _count: { select: { reviews: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.wishlist.count({ where: { userId } }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, items, { page: Number(page), limit: Number(limit), total });
};

export const addToWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId } = req.body;

  const product = await prisma.product.findUnique({ where: { id: Number(productId) } });
  if (!product) throw ApiError.notFound('Không tìm thấy sản phẩm');
  if (product.status !== 'APPROVED') throw ApiError.badRequest('Sản phẩm không khả dụng');

  const existing = await prisma.wishlist.findFirst({
    where: { userId, productId: Number(productId) },
  });

  if (existing) throw ApiError.badRequest('Sản phẩm đã có trong wishlist');

  const wishlistItem = await prisma.wishlist.create({
    data: { userId, productId: Number(productId) },
    include: { product: true },
  });

  sendSuccess(res, wishlistItem, 'Thêm vào wishlist thành công', 201);
};

export const checkWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId } = req.params;

  const item = await prisma.wishlist.findFirst({
    where: { userId, productId: Number(productId) },
  });

  sendSuccess(res, { isInWishlist: !!item });
};

export const removeFromWishlist = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { productId } = req.params;

  const item = await prisma.wishlist.findFirst({
    where: { userId, productId: Number(productId) },
  });

  if (!item) throw ApiError.notFound('Không tìm thấy sản phẩm trong wishlist');

  await prisma.wishlist.delete({ where: { id: item.id } });
  sendSuccess(res, null, 'Xóa khỏi wishlist thành công');
};
