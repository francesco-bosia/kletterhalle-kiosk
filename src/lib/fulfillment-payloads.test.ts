import { describe, it, expect } from 'vitest';
import {
  buildPayloadsFromMetadata,
  PermanentFulfillmentError,
} from '@/lib/fulfillment-payloads';
import { getProductById } from '@/lib/catalog';

const adult = getProductById('adult')!;
const price = adult.isFree ? 0 : adult.priceCents;

describe('buildPayloadsFromMetadata', () => {
  it('rebuilds print and log payloads from compact metadata', () => {
    const { print, log } = buildPayloadsFromMetadata(
      {
        cartData: JSON.stringify([{ id: 'adult', qty: 2 }]),
        lang: 'it',
        paymentMethod: 'card',
      },
      {
        transactionId: 'pi_1',
        stripeIds: { paymentIntent: 'pi_1' },
        chargedAmount: price * 2,
      }
    );
    expect(print.items).toEqual([
      { name: adult.label.it, quantity: 2, price },
    ]);
    expect(print.total).toBe(price * 2);
    expect(print.transactionId).toBe('pi_1');
    expect(print.paymentMethod).toBe('Carta'); // it-localized label for card
    expect(log.items).toEqual([
      { ticketId: 'adult', ticketName: adult.label.it, quantity: 2, price },
    ]);
    expect(log.total).toBe(price * 2);
    expect(log.paymentMethod).toBe('card'); // raw method in the audit log
    expect(log.stripeIds).toEqual({ paymentIntent: 'pi_1' });
  });

  it('uses the Stripe-charged amount as the total, not the catalog sum', () => {
    const charged = price * 2 + 100;
    const { print, log } = buildPayloadsFromMetadata(
      {
        cartData: JSON.stringify([{ id: 'adult', qty: 2 }]),
        lang: 'it',
        paymentMethod: 'card',
      },
      {
        transactionId: 'pi_1',
        stripeIds: { paymentIntent: 'pi_1' },
        chargedAmount: charged,
      }
    );
    expect(print.total).toBe(charged);
    expect(log.total).toBe(charged);
  });

  it('uses English labels and "Card" when lang=en', () => {
    const { print } = buildPayloadsFromMetadata(
      {
        cartData: JSON.stringify([{ id: 'adult', qty: 1 }]),
        lang: 'en',
        paymentMethod: 'card',
      },
      {
        transactionId: 'pi_2',
        stripeIds: { paymentIntent: 'pi_2' },
        chargedAmount: price,
      }
    );
    expect(print.items[0].name).toBe(adult.label.en);
    expect(print.paymentMethod).toBe('Card');
  });

  it('labels TWINT as TWINT in both languages', () => {
    const { print } = buildPayloadsFromMetadata(
      {
        cartData: JSON.stringify([{ id: 'adult', qty: 1 }]),
        lang: 'it',
        paymentMethod: 'twint',
      },
      {
        transactionId: 'cs_1',
        stripeIds: { checkoutSession: 'cs_1' },
        chargedAmount: price,
      }
    );
    expect(print.paymentMethod).toBe('TWINT');
  });

  it('throws PermanentFulfillmentError on missing or invalid cartData', () => {
    expect(() =>
      buildPayloadsFromMetadata({}, {
        transactionId: 'pi_3',
        stripeIds: { paymentIntent: 'pi_3' },
        chargedAmount: 700,
      })
    ).toThrow(PermanentFulfillmentError);
    expect(() =>
      buildPayloadsFromMetadata({ cartData: 'not json' }, {
        transactionId: 'pi_3',
        stripeIds: { paymentIntent: 'pi_3' },
        chargedAmount: 700,
      })
    ).toThrow(PermanentFulfillmentError);
  });

  it('throws PermanentFulfillmentError on unknown product ids', () => {
    expect(() =>
      buildPayloadsFromMetadata(
        { cartData: JSON.stringify([{ id: 'nope', qty: 1 }]), lang: 'it' },
        {
          transactionId: 'pi_4',
          stripeIds: { paymentIntent: 'pi_4' },
          chargedAmount: 700,
        }
      )
    ).toThrow(/Unknown product/);
  });
});
