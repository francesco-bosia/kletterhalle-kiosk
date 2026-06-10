import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { headers } from 'next/headers';

/**
 * POST /api/webhooks/stripe
 *
 * Verifies Stripe webhook signatures and logs received events.
 *
 * NOTE: Printing and transaction logging are handled CLIENT-SIDE on the kiosk
 * (see src/components/wizard/* + src/lib/completion-client.ts). The webhook
 * cannot reach the kiosk's local /api/print or /api/transactions/log, and
 * doing those here would double-print/double-log if the Pi ever becomes
 * webhook-reachable. Stripe object metadata (set in /api/payments/create) is
 * the durable cloud record.
 *
 * Events observed:
 * - checkout.session.completed: TWINT payments via Checkout
 * - payment_intent.succeeded: card payments via Terminal
 * - payment_intent.payment_failed: payment failures
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature provided' }, { status: 400 });
    }

    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Received webhook event:', event.type);

    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as { id: string; last_payment_error?: { message?: string } };
      console.error('Payment failed:', {
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
