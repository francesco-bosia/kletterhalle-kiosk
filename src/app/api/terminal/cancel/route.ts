import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { fulfillPaymentIntent } from '@/lib/fulfillment';
import {
  cancelPayment,
  getReaderId,
  type StripeTerminalClient,
} from '@/lib/terminal-payment';

/**
 * POST /api/terminal/cancel { paymentIntentId }
 * { busy: true } → reader is mid-authorization; the kiosk keeps polling
 * state through a grace window (a charge that lands wins over the cancel).
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json();
    if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
    }
    const stripe = getStripe() as unknown as StripeTerminalClient;
    const result = await cancelPayment(stripe, getReaderId(), paymentIntentId);
    // Cancel-race: the charge landed just as we tried to cancel. Fulfill now
    // (idempotent, mutexed, sweep-backstopped) so the ticket prints
    // immediately instead of waiting for the next reconcile sweep.
    if (!result.busy && result.state === 'succeeded') {
      void fulfillPaymentIntent(getStripe(), paymentIntentId);
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error('Terminal cancel error:', error);
    return NextResponse.json({ error: 'terminal-error' }, { status: 500 });
  }
}
