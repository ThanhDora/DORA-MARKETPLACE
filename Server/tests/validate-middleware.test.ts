import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateParams, validateQuery } from '../src/middleware/validate.middleware.js';

describe('validate.middleware', () => {
  it('validateBody replaces req.body with parsed payload', () => {
    const middleware = validateBody(z.object({ amount: z.coerce.number().int().positive() }));
    const req = { body: { amount: '7' } };
    const next = vi.fn();

    middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.body.amount).toBe(7);
  });

  it('validateQuery replaces req.query with parsed payload', () => {
    const middleware = validateQuery(z.object({ page: z.coerce.number().int().positive().default(1) }));
    const req = { query: { page: '5' } };
    const next = vi.fn();

    middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.query.page).toBe(5);
  });

  it('validateParams forwards ApiError when validation fails', () => {
    const middleware = validateParams(z.object({ id: z.coerce.number().int().positive() }));
    const req = { params: { id: 'x' } };
    const next = vi.fn();

    middleware(req as never, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as { statusCode?: number; message?: string };
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('id');
  });
});
