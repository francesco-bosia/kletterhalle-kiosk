import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { fulfillPaymentIntent } from '@/lib/fulfillment';

/**
 * POST /api/fulfill { paymentIntentId }
 * Card fast-path: called by the kiosk client right after Terminal
 * processPayment succeeds. Idempotent — the sweep dedups via the same store.
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json();
    if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json(
        { error: 'paymentIntentId required' },
        { status: 400 }
      );
    }
    const outcome = await fulfillPaymentIntent(getStripe(), paymentIntentId);
    return NextResponse.json({ outcome });
  } catch (error) {
    console.error('Fulfill error:', error);
    return NextResponse.json({ error: 'Fulfillment failed' }, { status: 500 });
  }
}
