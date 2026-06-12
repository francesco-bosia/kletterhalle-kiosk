import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { fulfillPaymentIntent } from '@/lib/fulfillment';
import {
  getPaymentState,
  getReaderId,
  isReaderOnline,
  type StripeTerminalClient,
} from '@/lib/terminal-payment';

/**
 * GET /api/terminal/state            → { readerOnline }
 * GET /api/terminal/state?paymentIntentId=pi_… → { state, code? }
 *
 * The kiosk's poll target (1 Hz during a payment). On observing `succeeded`
 * this route triggers fulfillment server-side — idempotent and mutexed in
 * the engine, reconcile sweep as backstop — so printing never depends on a
 * further client request.
 */
export async function GET(request: NextRequest) {
  try {
    const stripe = getStripe() as unknown as StripeTerminalClient;
    const readerId = getReaderId();
    const paymentIntentId = request.nextUrl.searchParams.get('paymentIntentId');

    if (!paymentIntentId) {
      return NextResponse.json({ readerOnline: await isReaderOnline(stripe, readerId) });
    }
    if (!paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ error: 'invalid paymentIntentId' }, { status: 400 });
    }

    const result = await getPaymentState(stripe, readerId, paymentIntentId, (id) => {
      void fulfillPaymentIntent(getStripe(), id);
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Terminal state error:', error);
    return NextResponse.json({ error: 'terminal-error' }, { status: 500 });
  }
}
