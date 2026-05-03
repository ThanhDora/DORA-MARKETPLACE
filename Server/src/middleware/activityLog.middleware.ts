import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

const TRACKED_ROLES = new Set(['ADMIN', 'SELLER']);
const SKIP_PATHS = new Set([
  '/api/admin/activity-logs',
]);

function normalizePath(originalUrl: string): string {
  return originalUrl.split('?')[0] || originalUrl;
}

function extractEntity(pathname: string): { entity?: string; entityId?: number } {
  const segments = pathname
    .replace(/^\/api\/?/, '')
    .split('/')
    .filter(Boolean);

  if (!segments.length) return {};

  const root = segments[0];
  const entity = (root === 'admin' || root === 'seller') && segments[1] ? segments[1] : root;
  const idSegment = segments.find((segment) => /^\d+$/.test(segment));
  const entityId = idSegment ? Number(idSegment) : undefined;

  return { entity, entityId };
}

export function captureActivityLog(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();

  res.on('finish', () => {
    const user = req.user;
    if (!user) return;
    if (!TRACKED_ROLES.has(String(user.role))) return;

    const path = normalizePath(req.originalUrl || req.url || '');
    if (!path.startsWith('/api/')) return;
    if (SKIP_PATHS.has(path)) return;

    const { entity, entityId } = extractEntity(path);
    const action = `${req.method.toUpperCase()} ${path}`;
    const ip = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() || req.ip || undefined;

    void prisma.activityLog.create({
      data: {
        userId: user.userId,
        action,
        entity,
        entityId,
        ip,
        metadata: {
          method: req.method.toUpperCase(),
          path,
          statusCode: res.statusCode,
          durationMs: Date.now() - startedAt,
        },
      },
    }).catch(() => undefined);
  });

  next();
}
