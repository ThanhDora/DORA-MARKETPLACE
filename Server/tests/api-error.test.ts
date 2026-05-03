import { describe, expect, it } from 'vitest';
import { ApiError } from '../src/utils/ApiError.js';

describe('ApiError', () => {
  it('creates typed errors with proper status code', () => {
    const err = ApiError.notFound('Missing resource');
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(404);
    expect(err.message).toBe('Missing resource');
    expect(err.isOperational).toBe(true);
  });

  it('marks internal errors as non-operational', () => {
    const err = ApiError.internal('Crash');
    expect(err.statusCode).toBe(500);
    expect(err.isOperational).toBe(false);
  });
});
