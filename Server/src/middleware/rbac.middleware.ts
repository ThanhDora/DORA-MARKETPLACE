import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/ApiError.js';

export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Vui lòng đăng nhập');
    }

    if (!roles.includes(req.user.role)) {
      throw ApiError.forbidden('Bạn không có quyền thực hiện hành động này');
    }

    next();
  };
};

export const requireMinRole = (minRole: string) => {
  const roleHierarchy = ['USER', 'SELLER', 'ADMIN'];
  const minRoleIndex = roleHierarchy.indexOf(minRole);

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Vui lòng đăng nhập');
    }

    const userRoleIndex = roleHierarchy.indexOf(req.user.role);
    if (userRoleIndex < minRoleIndex) {
      throw ApiError.forbidden('Bạn không có quyền thực hiện hành động này');
    }

    next();
  };
};

export const requireOwnerOrAdmin = (getOwnerId: (req: Request) => number | null) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw ApiError.unauthorized('Vui lòng đăng nhập');
    }

    const ownerId = getOwnerId(req);
    if (ownerId === null) {
      throw ApiError.notFound('Không tìm thấy tài nguyên');
    }
    if (ownerId !== req.user.userId && req.user.role !== 'ADMIN') {
      throw ApiError.forbidden('Bạn không có quyền thực hiện hành động này');
    }

    next();
  };
};
