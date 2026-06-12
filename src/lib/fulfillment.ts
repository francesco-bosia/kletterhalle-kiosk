import { FulfillmentStore, fulfillmentStore } from '@/lib/fulfillment-store';
import {
  buildPayloadsFromMetadata,
  PermanentFulfillmentError,
} from '@/lib/fulfillment-payloads';
import { printThermalReceipt } from '@/lib/thermal-printer';
import { appendTransactionLog } from '@/lib/transaction-log';
import type { PrintPayload, TransactionLogPayload } from '@/lib/cart';

export type FulfillmentOutcome =
  | 'fulfilled'         // side-effects executed and recorded
  | 'already-fulfilled' // marker says done; nothing to do
  | 'in-progress'       // another caller holds a fresh claim
  | 'pending'           // object exists but is not paid yet
  | 'not-payable'       // expired/canceled; will never be paid
  | 'needs-attention'   // permanent rebuild failure; parked for an operator
  | 'failed';           // transient side-effect error; claim released for retry

export interface FulfillmentDeps {
  store: FulfillmentStore;
  print: (p: PrintPayload) => Promise<void>;
  log: (p: TransactionLogPayload) => Promise<void>;
}

/**
 * Minimal Stripe surface the engine needs — keeps tests SDK-free.
 * Note: no line_items expand — we fulfill from our own metadata + catalog
 * (Stripe's sample expands line_items because it fulfills from them).
 */
export interface StripeFulfillmentClient {
  checkout: {
    sessions: {
      retrieve(id: string): Promise<{
        id: string;
        payment_status: string;
        status: string | null;
        metadata: Record<string, string> | null;
        payment_intent: string | { id: string } | null;
        amount_total: number | null;
      }>;
    };
  };
  paymentIntents: {
    retrieve(id: string): Promise<{
      id: string;
      status: string;
      metadata: Record<string, string> | null;
      amount: number;
    }>;
  };
}

const defaultDeps: FulfillmentDeps = {
  store: fulfillmentStore,
  print: printThermalReceipt,
  log: appendTransactionLog,
};

/** In-process mutex: serializes success-fast-path vs sweep for one id. */
const inflight = new Map<string, Promise<FulfillmentOutcome>>();

function withMutex(
  id: string,
  fn: () => Promise<FulfillmentOutcome>
): Promise<FulfillmentOutcome> {
  const prev = inflight.get(id) ?? Promise.resolve('fulfilled' as const);
  const next = prev.then(fn, fn).finally(() => {
    if (inflight.get(id) === next) inflight.delete(id);
  });
  inflight.set(id, next);
  return next;
}

async function executeFulfillment(
  deps: FulfillmentDeps,
  id: string,
  gate: () => Promise<
    | { ok: true; metadata: Record<string, string> | null; stripeIds: { paymentIntent?: string; checkoutSession?: string }; chargedAmount: number }
    | { ok: false; outcome: 'pending' | 'not-payable' }
  >
): Promise<FulfillmentOutcome> {
  const claim = await deps.store.claim(id);
  if (claim === 'already-done') return 'already-fulfilled';
  if (claim === 'in-progress') return 'in-progress';
  if (claim === 'needs-attention') return 'needs-attention';

  try {
    const gateResult = await gate();
    if (!gateResult.ok) {
      await deps.store.release(id);
      return gateResult.outcome;
    }
    const { print, log } = buildPayloadsFromMetadata(gateResult.metadata ?? {}, {
      transactionId: id,
      stripeIds: gateResult.stripeIds,
      chargedAmount: gateResult.chargedAmount,
    });
    await deps.print(print);
    await deps.log(log);
    await deps.store.markDone(id);
    return 'fulfilled';
  } catch (err) {
    if (err instanceof PermanentFulfillmentError) {
      // Paid customer + unrecoverable rebuild: park it loudly for an
      // operator instead of retrying every sweep until the 24h window
      // silently swallows it.
      console.error(`PERMANENT fulfillment failure for ${id}: ${err.message}`);
      await deps.store.markNeedsAttention(id, err.message);
      return 'needs-attention';
    }
    console.error(`Fulfillment failed for ${id} (will retry):`, err);
    await deps.store.release(id);
    return 'failed';
  }
}

/**
 * Idempotent TWINT fulfillment per Stripe's Checkout fulfillment guidance:
 * retrieve server-side, gate on payment_status, run exactly once.
 */
export function fulfillCheckoutSession(
  stripe: StripeFulfillmentClient,
  sessionId: string,
  deps: FulfillmentDeps = defaultDeps
): Promise<FulfillmentOutcome> {
  return withMutex(sessionId, () =>
    executeFulfillment(deps, sessionId, async () => {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status === 'unpaid') {
        return {
          ok: false,
          outcome: session.status === 'expired' ? 'not-payable' : 'pending',
        };
      }
      const pi =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;
      return {
        ok: true,
        metadata: session.metadata,
        stripeIds: {
          checkoutSession: session.id,
          ...(pi ? { paymentIntent: pi } : {}),
        },
        chargedAmount: session.amount_total ?? 0,
      };
    })
  );
}

/**
 * Card-path fulfillment net. With capture_method=automatic a successful
 * Terminal processPayment leaves the PI `succeeded` (verified against
 * Terminal docs); anything else is pending or dead.
 */
export function fulfillPaymentIntent(
  stripe: StripeFulfillmentClient,
  paymentIntentId: string,
  deps: FulfillmentDeps = defaultDeps
): Promise<FulfillmentOutcome> {
  return withMutex(paymentIntentId, () =>
    executeFulfillment(deps, paymentIntentId, async () => {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (pi.status !== 'succeeded') {
        return {
          ok: false,
          outcome: pi.status === 'canceled' ? 'not-payable' : 'pending',
        };
      }
      return {
        ok: true,
        metadata: pi.metadata,
        stripeIds: { paymentIntent: pi.id },
        chargedAmount: pi.amount,
      };
    })
  );
}
