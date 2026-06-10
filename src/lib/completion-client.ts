import type { PrintPayload, TransactionLogPayload } from '@/lib/cart';

export interface CompletionPayload {
  print: PrintPayload;
  log: TransactionLogPayload;
}

const PENDING_KEY = 'spluia.pendingCompletion';

/**
 * Fire-and-forget JSON POST. Never throws: a failed side-effect must not
 * disrupt the success screen. Runs on the kiosk itself (same-origin), so it
 * reaches the local API even when Stripe webhooks cannot reach the Pi.
 */
async function postJson(url: string, body: unknown): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error(`POST ${url} failed:`, res.status, detail);
    }
  } catch (err) {
    console.error(`POST ${url} error:`, err);
  }
}

export async function triggerPrint(payload: PrintPayload): Promise<void> {
  await postJson('/api/print', payload);
}

export async function logTransaction(payload: TransactionLogPayload): Promise<void> {
  await postJson('/api/transactions/log', payload);
}

/**
 * Run both completion side-effects (print receipt + log transaction).
 * Fire-and-forget; both swallow their own errors.
 */
export function completePayment(payload: CompletionPayload): void {
  void triggerPrint(payload.print);
  void logTransaction(payload.log);
}

/**
 * Persist a completion payload across the TWINT external redirect.
 * The SPA state (and the in-memory cart) is wiped when we navigate to
 * Stripe Checkout, so it is stashed in localStorage and replayed on return.
 */
export function stashPendingCompletion(payload: CompletionPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch (err) {
    console.error('Failed to stash pending completion:', err);
  }
}

/**
 * Read and remove the pending completion payload. Returns null if none.
 * Read-and-remove guarantees it replays at most once — guards against React
 * StrictMode double-invoke and manual page refreshes.
 */
export function takePendingCompletion(): CompletionPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    window.localStorage.removeItem(PENDING_KEY);
    return JSON.parse(raw) as CompletionPayload;
  } catch (err) {
    console.error('Failed to read pending completion:', err);
    return null;
  }
}

/**
 * Remove any stashed completion without replaying it. Used when a TWINT
 * checkout is cancelled/abandoned so a stale payload can never replay later.
 */
export function discardPendingCompletion(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch (err) {
    console.error('Failed to discard pending completion:', err);
  }
}
