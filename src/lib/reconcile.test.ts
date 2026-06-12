import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FulfillmentStore } from '@/lib/fulfillment-store';
import { reconcileOnce, type StripeReconcileClient } from '@/lib/reconcile';

let dir: string;
let store: FulfillmentStore;
let fulfillSession: ReturnType<typeof vi.fn>;
let fulfillIntent: ReturnType<typeof vi.fn>;

const paidTwint = {
  id: 'cs_paid',
  payment_status: 'paid',
  status: 'complete',
  metadata: { paymentMethod: 'twint' },
};
const unpaidTwint = {
  id: 'cs_unpaid',
  payment_status: 'unpaid',
  status: 'complete',
  metadata: { paymentMethod: 'twint' },
};
const succeededCard = {
  id: 'pi_ok',
  status: 'succeeded',
  metadata: { paymentMethod: 'card' },
};
const failedCard = {
  id: 'pi_bad',
  status: 'requires_payment_method',
  metadata: { paymentMethod: 'card' },
};
const foreignPi = { id: 'pi_other', status: 'succeeded', metadata: {} };

function fakeStripe(): StripeReconcileClient {
  return {
    checkout: {
      sessions: {
        list: vi.fn(() => ({
          autoPagingToArray: async () => [paidTwint, unpaidTwint],
        })),
      },
    },
    paymentIntents: {
      list: vi.fn(() => ({
        autoPagingToArray: async () => [succeededCard, failedCard, foreignPi],
      })),
    },
  } as unknown as StripeReconcileClient;
}

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sweep-'));
  store = new FulfillmentStore(dir);
  fulfillSession = vi.fn(async () => 'fulfilled');
  fulfillIntent = vi.fn(async () => 'fulfilled');
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('reconcileOnce', () => {
  it('fulfills only paid twint sessions and succeeded card PIs with our metadata', async () => {
    const stripe = fakeStripe();
    const result = await reconcileOnce(stripe, {
      store,
      fulfillSession,
      fulfillIntent,
    });
    expect(fulfillSession).toHaveBeenCalledTimes(1);
    expect(fulfillSession).toHaveBeenCalledWith(stripe, 'cs_paid');
    expect(fulfillIntent).toHaveBeenCalledTimes(1);
    expect(fulfillIntent).toHaveBeenCalledWith(stripe, 'pi_ok');
    expect(result.attempted).toBe(2);
  });

  it('skips ids already marked done', async () => {
    await store.claim('cs_paid');
    await store.markDone('cs_paid');
    await reconcileOnce(fakeStripe(), { store, fulfillSession, fulfillIntent });
    expect(fulfillSession).not.toHaveBeenCalled();
    expect(fulfillIntent).toHaveBeenCalledTimes(1);
  });

  it('lists with a 24h created lookback and status=complete for sessions', async () => {
    const stripe = fakeStripe();
    const before = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
    await reconcileOnce(stripe, { store, fulfillSession, fulfillIntent });
    const sessionArgs = (stripe.checkout.sessions.list as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(sessionArgs.status).toBe('complete');
    expect(sessionArgs.created.gte).toBeGreaterThanOrEqual(before - 5);
    const piArgs = (stripe.paymentIntents.list as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(piArgs.created.gte).toBeGreaterThanOrEqual(before - 5);
  });
});
