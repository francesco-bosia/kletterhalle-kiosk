import { NextResponse } from 'next/server';
import { runSweepSafely } from '@/lib/reconcile-scheduler';

/**
 * POST /api/fulfill/reconcile — run one sweep now (ops/debugging).
 * Goes through runSweepSafely so it shares the overlap guard with the
 * interval loop; a sweep already in flight returns { skipped: true }.
 */
export async function POST() {
  const result = await runSweepSafely();
  if ('error' in result && result.error) {
    return NextResponse.json({ error: 'Reconcile failed' }, { status: 500 });
  }
  return NextResponse.json(result);
}
