import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { sendSuccess, sendList } from '../utils/response.js';
import { ApiError } from '../utils/ApiError.js';

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

const getAncestorIds = async (categoryId: number): Promise<number[]> => {
  const ancestors: number[] = [];
  let currentId: number | null = categoryId;
  while (currentId) {
    const cat = await prisma.category.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    if (cat?.parentId) {
      ancestors.push(cat.parentId);
      currentId = cat.parentId;
    } else {
      currentId = null;
    }
  }
  return ancestors;
};

export const listCategories = async (req: Request, res: Response) => {
  const { page = '1', limit = '20', parentId, isActive, hasStock } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where: Prisma.CategoryWhereInput = {};
  if (parentId === 'null' || parentId === 'undefined') {
    where.parentId = null;
  } else if (parentId) {
    where.parentId = Number(parentId);
  }
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const stockFilter = hasStock === 'true'
    ? { stock: { gt: 0 }, status: 'APPROVED' as const }
    : undefined;

  if (stockFilter) {
    where.products = { some: stockFilter };
  }

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip,
      take,
      include: {
        parent: { select: { id: true, name: true } },
        _count: {
          select: {
            products: stockFilter ? { where: stockFilter } : true,
            children: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.category.count({ where }),
  ]);

  res.set('X-Total-Count', String(total));
  res.set('X-Total-Pages', String(Math.ceil(total / take)));
  sendList(res, categories, { page: Number(page), limit: Number(limit), total });
};

export const getCategory = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  if (isNaN(id) || id <= 0) {
    throw ApiError.badRequest('ID danh mục không hợp lệ');
  }

  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
      children: {
        where: { isActive: true },
        select: { id: true, name: true, slug: true },
      },
      _count: { select: { products: true } },
    },
  });

  if (!category) throw ApiError.notFound('Không tìm thấy danh mục');
  sendSuccess(res, category);
};

export const createCategory = async (req: Request, res: Response) => {
  const { name, description, icon, parentId, isActive = true } = req.body;

  let slug = req.body.slug || generateSlug(name);
  const existing = await prisma.category.findFirst({ where: { slug } });
  if (existing) slug = `${slug}-${Date.now()}`;

  if (parentId) {
    const parent = await prisma.category.findUnique({ where: { id: Number(parentId) } });
    if (!parent) throw ApiError.badRequest('Danh mục cha không tồn tại');
  }

  const category = await prisma.category.create({
    data: { name, slug, description, icon, parentId: parentId ? Number(parentId) : null, isActive },
    include: { parent: { select: { id: true, name: true } } },
  });

  sendSuccess(res, category, 'Tạo danh mục thành công', 201);
};

export const updateCategory = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { name, description, icon, parentId, isActive } = req.body;

  const category = await prisma.category.findUnique({ where: { id } });
  if (!category) throw ApiError.notFound('Không tìm thấy danh mục');

  let slug = category.slug;
  if (name && name !== category.name) {
    slug = req.body.slug || generateSlug(name);
    const existing = await prisma.category.findFirst({ where: { slug, NOT: { id } } });
    if (existing) slug = `${slug}-${Date.now()}`;
  }

  if (parentId && Number(parentId) === id) {
    throw ApiError.badRequest('Danh mục không thể là danh mục cha của chính nó');
  }

  if (parentId) {
    const ancestors = await getAncestorIds(Number(parentId));
    if (ancestors.includes(id)) {
      throw ApiError.badRequest('Không thể tạo vòng lặp danh mục');
    }
  }

  const updated = await prisma.category.update({
    where: { id },
    data: {
      ...(name && { name }),
      slug,
      ...(description !== undefined && { description }),
      ...(icon !== undefined && { icon }),
      ...(parentId !== undefined && { parentId: parentId ? Number(parentId) : null }),
      ...(isActive !== undefined && { isActive }),
    },
    include: { parent: { select: { id: true, name: true } } },
  });

  sendSuccess(res, updated, 'Cập nhật danh mục thành công');
};

export const deleteCategory = async (req: Request, res: Response) => {
  const id = Number(req.params.id);

  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });

  if (!category) throw ApiError.notFound('Không tìm thấy danh mục');
  if (category._count.products > 0) {
    throw ApiError.badRequest('Không thể xóa danh mục đã có sản phẩm');
  }
  if (category._count.children > 0) {
    throw ApiError.badRequest('Không thể xóa danh mục có danh mục con');
  }

  await prisma.category.delete({ where: { id } });
  sendSuccess(res, null, 'Xóa danh mục thành công');
};
