import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FulfillmentStore } from '@/lib/fulfillment-store';
import { getProductById } from '@/lib/catalog';
import {
  fulfillCheckoutSession,
  fulfillPaymentIntent,
  type FulfillmentDeps,
  type StripeFulfillmentClient,
} from '@/lib/fulfillment';

let dir: string;
let store: FulfillmentStore;
let print: ReturnType<typeof vi.fn>;
let log: ReturnType<typeof vi.fn>;
let deps: FulfillmentDeps;

const META = {
  cartData: JSON.stringify([{ id: 'adult', qty: 1 }]),
  lang: 'it',
  paymentMethod: 'card',
};

// The catalog price of 'adult' (engine tests use the real catalog).
const adultProduct = getProductById('adult')!;
const ADULT_PRICE = adultProduct.isFree ? 0 : adultProduct.priceCents;

function fakeStripe(overrides: {
  session?: Partial<{ id: string; payment_status: string; status: string; metadata: Record<string, string>; payment_intent: string | null; amount_total: number | null }>;
  pi?: Partial<{ id: string; status: string; metadata: Record<string, string>; amount: number }>;
}): StripeFulfillmentClient {
  return {
    checkout: {
      sessions: {
        retrieve: vi.fn(async () => ({
          id: 'cs_1',
          payment_status: 'paid',
          status: 'complete',
          metadata: { ...META, paymentMethod: 'twint' },
          payment_intent: 'pi_inner',
          amount_total: ADULT_PRICE,
          ...overrides.session,
        })),
      },
    },
    paymentIntents: {
      retrieve: vi.fn(async () => ({
        id: 'pi_1',
        status: 'succeeded',
        metadata: META,
        amount: ADULT_PRICE,
        ...overrides.pi,
      })),
    },
  } satisfies StripeFulfillmentClient;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'engine-'));
  store = new FulfillmentStore(dir);
  print = vi.fn(async () => {});
  log = vi.fn(async () => {});
  deps = { store, print, log };
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('fulfillPaymentIntent', () => {
  it('fulfills a succeeded PI exactly once', async () => {
    const stripe = fakeStripe({});
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('fulfilled');
    expect(print).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledTimes(1);
    // second call: dedup
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('already-fulfilled');
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('returns pending and releases the claim for a non-succeeded PI', async () => {
    const stripe = fakeStripe({ pi: { status: 'requires_payment_method' } });
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('pending');
    expect(print).not.toHaveBeenCalled();
    // claim released → can claim again
    expect(await store.claim('pi_1')).toBe('claimed');
  });

  it('returns not-payable for a canceled PI', async () => {
    const stripe = fakeStripe({ pi: { status: 'canceled' } });
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('not-payable');
    expect(print).not.toHaveBeenCalled();
  });

  it('releases the claim and returns failed when printing throws', async () => {
    print.mockRejectedValueOnce(new Error('out of paper'));
    const stripe = fakeStripe({});
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('failed');
    // retryable: next attempt succeeds
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('fulfilled');
  });

  it('serializes concurrent calls for the same id (one execution)', async () => {
    const stripe = fakeStripe({});
    const results = await Promise.all([
      fulfillPaymentIntent(stripe, 'pi_1', deps),
      fulfillPaymentIntent(stripe, 'pi_1', deps),
    ]);
    expect(results.sort()).toEqual(['already-fulfilled', 'fulfilled']);
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('parks a permanent rebuild failure as needs-attention (no retry loop)', async () => {
    const stripe = fakeStripe({
      pi: { metadata: { ...META, cartData: JSON.stringify([{ id: 'ghost', qty: 1 }]) } },
    });
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('needs-attention');
    expect(print).not.toHaveBeenCalled();
    // parked: a retry does NOT re-attempt
    expect(await fulfillPaymentIntent(stripe, 'pi_1', deps)).toBe('needs-attention');
    expect(stripe.paymentIntents.retrieve).toHaveBeenCalledTimes(1);
    expect(await store.needsAttention('pi_1')).toBe(true);
  });

  it('prints the Stripe-charged amount as the total', async () => {
    const stripe = fakeStripe({ pi: { amount: ADULT_PRICE + 100 } });
    await fulfillPaymentIntent(stripe, 'pi_1', deps);
    expect(print.mock.calls[0][0].total).toBe(ADULT_PRICE + 100);
  });

  it('returns failed (no escaped throw) when the store claim errors', async () => {
    const stripe = fakeStripe({});
    const brokenStore = {
      ...store,
      claim: vi.fn(async () => { throw new Error('ENOSPC'); }),
      release: vi.fn(async () => {}),
      markDone: vi.fn(async () => {}),
      markNeedsAttention: vi.fn(async () => {}),
      isDone: vi.fn(async () => false),
      needsAttention: vi.fn(async () => false),
    } as unknown as FulfillmentStore;
    const res = await fulfillPaymentIntent(stripe, 'pi_claimthrow', { store: brokenStore, print, log });
    expect(res).toBe('failed');
    expect(print).not.toHaveBeenCalled();
  });
});

describe('fulfillCheckoutSession', () => {
  it('fulfills a paid session and logs both stripe ids', async () => {
    const stripe = fakeStripe({});
    expect(await fulfillCheckoutSession(stripe, 'cs_1', deps)).toBe('fulfilled');
    expect(stripe.checkout.sessions.retrieve).toHaveBeenCalledWith('cs_1');
    const logged = log.mock.calls[0][0];
    expect(logged.stripeIds).toEqual({
      checkoutSession: 'cs_1',
      paymentIntent: 'pi_inner',
    });
    expect(logged.paymentMethod).toBe('twint');
  });

  it('returns pending for a complete-but-unpaid session (async TWINT)', async () => {
    const stripe = fakeStripe({ session: { payment_status: 'unpaid' } });
    expect(await fulfillCheckoutSession(stripe, 'cs_1', deps)).toBe('pending');
    expect(print).not.toHaveBeenCalled();
  });

  it('returns not-payable for an expired unpaid session', async () => {
    const stripe = fakeStripe({
      session: { payment_status: 'unpaid', status: 'expired' },
    });
    expect(await fulfillCheckoutSession(stripe, 'cs_1', deps)).toBe('not-payable');
  });
});
