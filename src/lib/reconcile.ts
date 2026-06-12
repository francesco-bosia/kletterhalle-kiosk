import type Stripe from 'stripe';
import { FulfillmentStore, fulfillmentStore } from '@/lib/fulfillment-store';
import {
  fulfillCheckoutSession,
  fulfillPaymentIntent,
  type FulfillmentOutcome,
  type StripeFulfillmentClient,
} from '@/lib/fulfillment';

const LOOKBACK_SECONDS = 24 * 60 * 60; // matches default session expiry
const PAGE_LIMIT = 1000;

export interface StripeReconcileClient extends StripeFulfillmentClient {
  checkout: StripeFulfillmentClient['checkout'] & {
    sessions: StripeFulfillmentClient['checkout']['sessions'] & {
      list(params: {
        status: 'complete';
        created: { gte: number };
        limit: number;
      }): {
        autoPagingToArray(opts: { limit: number }): Promise<
          Array<{
            id: string;
            payment_status: string;
            status: string | null;
            metadata: Record<string, string> | null;
          }>
        >;
      };
    };
  };
  paymentIntents: StripeFulfillmentClient['paymentIntents'] & {
    list(params: { created: { gte: number }; limit: number }): {
      autoPagingToArray(opts: { limit: number }): Promise<
        Array<{
          id: string;
          status: string;
          metadata: Record<string, string> | null;
        }>
      >;
    };
  };
}

export interface ReconcileDeps {
  store: FulfillmentStore;
  fulfillSession: (
    stripe: StripeFulfillmentClient,
    id: string
  ) => Promise<FulfillmentOutcome>;
  fulfillIntent: (
    stripe: StripeFulfillmentClient,
    id: string
  ) => Promise<FulfillmentOutcome>;
}

const defaultDeps: ReconcileDeps = {
  store: fulfillmentStore,
  fulfillSession: (s, id) => fulfillCheckoutSession(s, id),
  fulfillIntent: (s, id) => fulfillPaymentIntent(s, id),
};

/**
 * One reconciliation sweep. Stripe is the pending-queue: list recent paid /
 * succeeded objects and fulfill any not yet marked done. payment_status and
 * metadata cannot be filtered server-side (verified against the API refs),
 * so those filters happen here.
 */
export async function reconcileOnce(
  stripe: StripeReconcileClient,
  deps: ReconcileDeps = defaultDeps
): Promise<{ attempted: number; fulfilled: number }> {
  const gte = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;
  let attempted = 0;
  let fulfilled = 0;

  const sessions = await stripe.checkout.sessions
    .list({ status: 'complete', created: { gte }, limit: 100 })
    .autoPagingToArray({ limit: PAGE_LIMIT });
  for (const s of sessions) {
    if (s.metadata?.paymentMethod !== 'twint') continue;
    if (s.payment_status !== 'paid') continue;
    if (await deps.store.isDone(s.id)) continue;
    if (await deps.store.needsAttention(s.id)) continue; // parked for operator
    attempted++;
    if ((await deps.fulfillSession(stripe, s.id)) === 'fulfilled') fulfilled++;
  }

  const intents = await stripe.paymentIntents
    .list({ created: { gte }, limit: 100 })
    .autoPagingToArray({ limit: PAGE_LIMIT });
  for (const pi of intents) {
    if (pi.metadata?.paymentMethod !== 'card') continue;
    if (pi.status !== 'succeeded') continue;
    if (await deps.store.isDone(pi.id)) continue;
    if (await deps.store.needsAttention(pi.id)) continue; // parked for operator
    attempted++;
    if ((await deps.fulfillIntent(stripe, pi.id)) === 'fulfilled') fulfilled++;
  }

  return { attempted, fulfilled };
}

/** Production entrypoint binding the real Stripe client type. */
export function reconcileWith(stripe: Stripe) {
  return reconcileOnce(stripe as unknown as StripeReconcileClient);
}
