import type { NextFunction, Request, Response } from 'express';

export class ApiError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(statusCode: number, message: string, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string) {
    return new ApiError(400, message);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message);
  }

  static conflict(message: string) {
    return new ApiError(409, message);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, false);
  }
}

type ErrorShape = {
  statusCode?: number;
  message?: string;
  name?: string;
  code?: string;
  stack?: string;
};

function normalizeError(error: unknown): ErrorShape {
  if (error && typeof error === 'object') {
    return error as ErrorShape;
  }
  return {};
}

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const normalized = normalizeError(err);

  let statusCode = normalized.statusCode || 500;
  let message = normalized.message || 'Internal server error';

  if (normalized.name === 'ValidationError') {
    statusCode = 400;
    message = normalized.message || 'Validation error';
  }

  if (normalized.code === 'P2002') {
    statusCode = 409;
    message = 'Dữ liệu đã tồn tại';
  }

  if (normalized.code === 'P2025') {
    statusCode = 404;
    message = 'Không tìm thấy dữ liệu';
  }

  if (normalized.name === 'TokenExpiredError') {
    statusCode = normalized.statusCode || 401;
  }

  if (normalized.name === 'JsonWebTokenError') {
    statusCode = normalized.statusCode || 401;
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: normalized.stack }),
  });
};

export const asyncHandler = <T>(fn: (req: Request, res: Response, next: NextFunction) => Promise<T>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
