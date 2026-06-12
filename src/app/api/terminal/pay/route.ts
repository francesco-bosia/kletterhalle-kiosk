import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import {
  getReaderId,
  startPayment,
  type StartPaymentError,
  type StripeTerminalClient,
} from '@/lib/terminal-payment';

const HTTP_STATUS: Record<StartPaymentError, number> = {
  'reader-offline': 503,
  'reader-busy': 409,
  'payment-not-payable': 409,
  'terminal-error': 500,
};

/**
 * POST /api/terminal/pay { paymentIntentId }
 * Pushes the PI to the kiosk's reader (server-driven Terminal). Also the
 * retry path after a decline — same PI, per Stripe guidance.
 */
export async function POST(request: NextRequest) {
  try {
    const { paymentIntentId } = await request.json();
    if (typeof paymentIntentId !== 'string' || !paymentIntentId.startsWith('pi_')) {
      return NextResponse.json({ error: 'paymentIntentId required' }, { status: 400 });
    }
    const stripe = getStripe() as unknown as StripeTerminalClient;
    const result = await startPayment(stripe, getReaderId(), paymentIntentId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: HTTP_STATUS[result.error] });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Terminal pay error:', error);
    return NextResponse.json({ error: 'terminal-error' }, { status: 500 });
  }
}
