import { describe, it, expect } from 'vitest';
import {
  toPrintPayload,
  toTransactionLogPayload,
  type CartLine,
} from '@/lib/cart';

const cart: CartLine[] = [
  {
    productId: 'adult',
    groupId: 'tickets',
    labelIt: 'Biglietto adulto',
    labelEn: 'Adult ticket',
    priceCents: 700,
    quantity: 2,
  },
];

describe('toPrintPayload', () => {
  it('emits items with the keys the thermal printer consumes', () => {
    const payload = toPrintPayload(cart, {
      transactionId: 'pi_1',
      paymentMethod: 'Carta',
      lang: 'it',
    });
    // printThermalReceipt reads item.name / item.quantity / item.price
    expect(payload.items[0]).toEqual({
      name: 'Biglietto adulto',
      quantity: 2,
      price: 700,
    });
    expect(payload).toMatchObject({
      total: 1400,
      transactionId: 'pi_1',
      paymentMethod: 'Carta',
      lang: 'it',
    });
  });
});

describe('toTransactionLogPayload', () => {
  it('emits items with the keys /api/transactions/log expects', () => {
    const payload = toTransactionLogPayload(cart, {
      paymentMethod: 'card',
      lang: 'it',
      stripeIds: { paymentIntent: 'pi_1' },
    });
    // /api/transactions/log TransactionLog.items = {ticketId, ticketName, quantity, price}
    expect(payload.items[0]).toEqual({
      ticketId: 'adult',
      ticketName: 'Biglietto adulto',
      quantity: 2,
      price: 700,
    });
    expect(payload).toMatchObject({
      total: 1400,
      paymentMethod: 'card',
      stripeIds: { paymentIntent: 'pi_1' },
    });
  });

  it('uses English labels when lang is en', () => {
    const payload = toTransactionLogPayload(cart, {
      paymentMethod: 'twint',
      lang: 'en',
      stripeIds: { checkoutSession: 'cs_1' },
    });
    expect(payload.items[0].ticketName).toBe('Adult ticket');
  });
});
