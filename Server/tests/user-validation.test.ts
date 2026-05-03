import { describe, expect, it } from 'vitest';
import { notificationIdParamSchema, notificationQuerySchema, userOrderQuerySchema } from '../src/validations/user.validation.js';

describe('user.validation', () => {
  it('parses order query values with coercion', () => {
    const parsed = userOrderQuerySchema.parse({ page: '3', limit: '15', status: 'CONFIRMED' });
    expect(parsed.page).toBe(3);
    expect(parsed.limit).toBe(15);
    expect(parsed.status).toBe('CONFIRMED');
  });

  it('parses notification query values', () => {
    const parsed = notificationQuerySchema.parse({ page: '2', limit: '10', isRead: 'true' });
    expect(parsed.page).toBe(2);
    expect(parsed.limit).toBe(10);
    expect(parsed.isRead).toBe('true');
  });

  it('rejects invalid notification id', () => {
    expect(() => notificationIdParamSchema.parse({ id: '0' })).toThrow();
  });
});
