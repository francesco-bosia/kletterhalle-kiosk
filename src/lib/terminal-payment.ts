/**
 * Server-driven Stripe Terminal engine. The server pushes PaymentIntents to
 * the reader through Stripe's cloud and the kiosk polls state — no
 * browser-to-reader local network path (see the 2026-06-12 design spec).
 * SDK-free interface mirrors fulfillment.ts so tests need no Stripe SDK.
 */

/** Client-facing payment states; the UI maps these to i18n strings. */
export type TerminalPaymentState =
  | { state: 'waiting' }
  | { state: 'declined'; code: string | null }
  | { state: 'succeeded' }
  | { state: 'canceled' };

export type StartPaymentError =
  | 'reader-offline'
  | 'reader-busy'
  | 'payment-not-payable'
  | 'terminal-error';

export type StartPaymentResult = { ok: true } | { ok: false; error: StartPaymentError };

export type CancelPaymentResult =
  | { busy: true }
  | { busy: false; state: 'canceled' | 'succeeded' };

export interface ReaderSnapshot {
  id: string;
  status: string; // 'online' | 'offline'
  action: {
    type: string;
    status: string; // 'in_progress' | 'succeeded' | 'failed'
    failure_code?: string | null;
    process_payment_intent?: {
      payment_intent: string | { id: string };
    } | null;
  } | null;
}

export interface StripeTerminalClient {
  terminal: {
    readers: {
      retrieve(id: string): Promise<ReaderSnapshot>;
      processPaymentIntent(
        id: string,
        params: {
          payment_intent: string;
          process_config?: { enable_customer_cancellation?: boolean };
        }
      ): Promise<unknown>;
      cancelAction(id: string): Promise<unknown>;
    };
  };
  paymentIntents: {
    retrieve(id: string): Promise<{ id: string; status: string }>;
    cancel(id: string): Promise<unknown>;
  };
}

/** The reader this kiosk drives. Throws when unconfigured (routes map to 500). */
export function getReaderId(): string {
  const id = process.env.STRIPE_TERMINAL_READER_ID;
  if (!id) throw new Error('STRIPE_TERMINAL_READER_ID environment variable is not set');
  return id;
}

function stripeErrorCode(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'code' in err
    ? String((err as { code: unknown }).code)
    : undefined;
}

export async function isReaderOnline(
  stripe: StripeTerminalClient,
  readerId: string
): Promise<boolean> {
  const reader = await stripe.terminal.readers.retrieve(readerId);
  return reader.status === 'online';
}

/** Push the PI to the reader. Also the retry path after a decline (same PI). */
export async function startPayment(
  stripe: StripeTerminalClient,
  readerId: string,
  paymentIntentId: string
): Promise<StartPaymentResult> {
  try {
    await stripe.terminal.readers.processPaymentIntent(readerId, {
      payment_intent: paymentIntentId,
      process_config: { enable_customer_cancellation: true },
    });
    return { ok: true };
  } catch (err) {
    switch (stripeErrorCode(err)) {
      case 'terminal_reader_offline':
        return { ok: false, error: 'reader-offline' };
      case 'terminal_reader_busy':
        return { ok: false, error: 'reader-busy' };
      case 'payment_intent_unexpected_state':
        return { ok: false, error: 'payment-not-payable' };
      default:
        console.error('Terminal processPaymentIntent failed:', err);
        return { ok: false, error: 'terminal-error' };
    }
  }
}

/**
 * One poll step. Reads the READER action first: a declined PI falls back to
 * requires_payment_method (same status as "not tapped yet"), so the decline
 * signal only exists on the reader action (verified against Terminal docs).
 */
export async function getPaymentState(
  stripe: StripeTerminalClient,
  readerId: string,
  paymentIntentId: string,
  onSucceeded: (paymentIntentId: string) => void
): Promise<TerminalPaymentState> {
  const reader = await stripe.terminal.readers.retrieve(readerId);
  const action = reader.action;
  const target = action?.process_payment_intent?.payment_intent;
  const actionPi = typeof target === 'string' ? target : target?.id;

  if (action?.type === 'process_payment_intent' && actionPi === paymentIntentId) {
    if (action.status === 'in_progress') return { state: 'waiting' };
    if (action.status === 'failed') {
      return { state: 'declined', code: action.failure_code ?? null };
    }
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
  if (pi.status === 'succeeded') {
    onSucceeded(pi.id);
    return { state: 'succeeded' };
  }
  if (pi.status === 'canceled') return { state: 'canceled' };
  return { state: 'waiting' };
}

/**
 * Cancel flow: stop the reader action, then void the PI. Reader busy means
 * the customer tapped at the buzzer — caller polls through a grace window.
 */
export async function cancelPayment(
  stripe: StripeTerminalClient,
  readerId: string,
  paymentIntentId: string
): Promise<CancelPaymentResult> {
  try {
    await stripe.terminal.readers.cancelAction(readerId);
  } catch (err) {
    if (stripeErrorCode(err) === 'terminal_reader_busy') return { busy: true };
    // No cancelable action (none in flight / already finished): fall through.
  }
  try {
    await stripe.paymentIntents.cancel(paymentIntentId);
    return { busy: false, state: 'canceled' };
  } catch {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (pi.status === 'succeeded') return { busy: false, state: 'succeeded' };
    return { busy: false, state: 'canceled' };
  }
}
