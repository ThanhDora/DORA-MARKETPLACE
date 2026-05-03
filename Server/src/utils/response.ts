import { Response } from 'express';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

export const getPagination = (page: number, limit: number) => {
  const safePage = Math.max(1, page || 1);
  const safeLimit = Math.min(100, Math.max(1, limit || 10));
  return { take: safeLimit, skip: (safePage - 1) * safeLimit };
};

export const getPaginationMeta = (page: number, limit: number, total: number): PaginationMeta => {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  };
};

export const sendSuccess = <T>(res: Response, data?: T, message = 'Thành công', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    ...(data !== undefined && { data }),
  });
};

export const sendCreated = <T>(res: Response, data: T, message = 'Tạo thành công') => {
  sendSuccess(res, data, message, 201);
};

export const sendNoContent = (res: Response) => {
  res.status(204).send();
};

export const sendMessage = (res: Response, message: string, statusCode = 200) => {
  res.status(statusCode).json({ success: true, message });
};

export const sendList = <T>(res: Response, items: T[], meta: PaginationMeta) => {
  res.status(200).json({
    success: true,
    data: items,
    pagination: meta,
  });
};
