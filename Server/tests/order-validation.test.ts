import { describe, expect, it } from 'vitest';
import { createOrderSchema, createPaymentSchema, orderQuerySchema, paymentQuerySchema } from '../src/validations/order.validation.js';

describe('order.validation', () => {
  it('coerces createOrder payload to typed values', () => {
    const parsed = createOrderSchema.parse({
      items: [{ productId: '12', quantity: '3' }],
      paymentMethod: 'PLATFORM',
    });

    expect(parsed.items[0].productId).toBe(12);
    expect(parsed.items[0].quantity).toBe(3);
    expect(parsed.paymentMethod).toBe('PLATFORM');
  });

  it('rejects empty order items', () => {
    expect(() => createOrderSchema.parse({ items: [] })).toThrow();
  });

  it('allows all supported payment methods including PLATFORM', () => {
    const parsed = createPaymentSchema.parse({ orderId: '88', method: 'PLATFORM' });
    expect(parsed.orderId).toBe(88);
    expect(parsed.method).toBe('PLATFORM');
  });

  it('coerces order/payment query params', () => {
    const orderQuery = orderQuerySchema.parse({ page: '2', limit: '25', status: 'PAID' });
    expect(orderQuery.page).toBe(2);
    expect(orderQuery.limit).toBe(25);
    expect(orderQuery.status).toBe('PAID');

    const paymentQuery = paymentQuerySchema.parse({ page: '1', limit: '20', orderId: '9', status: 'FAILED' });
    expect(paymentQuery.orderId).toBe(9);
    expect(paymentQuery.status).toBe('FAILED');
  });
});
