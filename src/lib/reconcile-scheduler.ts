import { getStripe } from '@/lib/stripe';
import { reconcileWith } from '@/lib/reconcile';

const DEFAULT_INTERVAL_MS = 60_000;

// Survives Next.js dev-mode module re-evaluation.
const globalKey = Symbol.for('kletterhalle.reconcileLoop');
type GlobalWithLoop = typeof globalThis & { [globalKey]?: boolean };

let sweepRunning = false;

export type SweepResult =
  | { skipped: true }
  | { skipped: false; attempted: number; fulfilled: number }
  | { skipped: false; error: true };

/**
 * Single overlap-guarded entrypoint for sweeps — used by BOTH the interval
 * and the manual /api/fulfill/reconcile route, so concurrent triggers can't
 * amplify Stripe API calls (review finding).
 */
export async function runSweepSafely(): Promise<SweepResult> {
  if (sweepRunning) return { skipped: true };
  sweepRunning = true;
  try {
    const result = await reconcileWith(getStripe());
    if (result.attempted > 0) {
      console.log(
        `[reconcile] attempted=${result.attempted} fulfilled=${result.fulfilled}`
      );
    }
    return { skipped: false, ...result };
  } catch (err) {
    console.error('[reconcile] sweep failed:', err);
    return { skipped: false, error: true };
  } finally {
    sweepRunning = false;
  }
}

export function startReconcileLoop(): void {
  const g = globalThis as GlobalWithLoop;
  if (g[globalKey]) return;
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[reconcile] STRIPE_SECRET_KEY not set; loop not started');
    return;
  }
  const interval = Number(
    process.env.FULFILL_RECONCILE_INTERVAL_MS ?? DEFAULT_INTERVAL_MS
  );
  // NaN guard is load-bearing: setInterval(cb, NaN) is a ~1ms hot loop.
  if (!Number.isFinite(interval) || interval <= 0) {
    console.warn('[reconcile] invalid or non-positive interval; loop disabled');
    return;
  }
  g[globalKey] = true;
  setInterval(() => void runSweepSafely(), interval);
  // Catch up immediately on boot (covers outages while powered off).
  void runSweepSafely();
  console.log(`[reconcile] loop started, every ${interval}ms`);
}
