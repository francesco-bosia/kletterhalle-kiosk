import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { headers } from 'next/headers';
import { getTicketById, formatTicketPrice } from '@/lib/tickets';

/**
 * POST /api/webhooks/stripe
 *
 * Handles Stripe webhook events for payment confirmation.
 * Verifies webhook signatures and processes payment success events.
 *
 * Events handled:
 * - checkout.session.completed: TWINT payments via Checkout
 * - payment_intent.succeeded: Card payments via Terminal
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Verify webhook signature
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      );
    }

    console.log('Received webhook event:', event.type);

    // Handle checkout session completed (TWINT payments)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;

      if (session.payment_status === 'paid') {
        const ticketId = session.metadata?.ticketId;

        if (ticketId) {
          const ticket = getTicketById(ticketId);

          console.log('TWINT payment successful:', {
            sessionId: session.id,
            ticketId,
            ticketName: ticket?.name,
            amount: session.amount_total,
          });

          // Log transaction locally
          const cartData = session.metadata?.cartData;
          await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/transactions/log`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: cartData ? JSON.parse(cartData) : [],
              total: session.amount_total,
              paymentMethod: 'TWINT',
              stripeIds: { checkoutSession: session.id, paymentIntent: session.payment_intent },
            }),
          }).catch(err => console.error('Transaction log failed:', err));

          // Trigger thermal print
          try {
            const cartData = session.metadata?.cartData;
            const items = cartData ? JSON.parse(cartData) : [];

            await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/print`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                items,
                total: session.amount_total,
                transactionId: session.payment_intent,
                paymentMethod: 'TWINT',
              }),
            });
          } catch (printError) {
            console.error('Webhook print failed:', printError);
            // Don't fail webhook if print fails
          }
        }
      }
    }

    // Handle payment intent succeeded (Card payments via Terminal)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;

      const ticketId = paymentIntent.metadata?.ticketId;

      if (ticketId) {
        const ticket = getTicketById(ticketId);

        console.log('Card payment successful:', {
          paymentIntentId: paymentIntent.id,
          ticketId,
          ticketName: ticket?.name,
          amount: paymentIntent.amount,
        });

        // Log transaction locally
        const cartData = paymentIntent.metadata?.cartData;
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/transactions/log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: cartData ? JSON.parse(cartData) : [],
            total: paymentIntent.amount,
            paymentMethod: 'card',
            stripeIds: { paymentIntent: paymentIntent.id },
          }),
        }).catch(err => console.error('Transaction log failed:', err));

        // In production, this would trigger the printer
        // The Terminal SDK will have already shown success on the device
      }

      // Trigger thermal print
      try {
        const cartData = paymentIntent.metadata?.cartData;
        const items = cartData ? JSON.parse(cartData) : [];

        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            total: paymentIntent.amount,
            transactionId: paymentIntent.id,
            paymentMethod: 'Karte',
          }),
        });
      } catch (printError) {
        console.error('Webhook print failed:', printError);
        // Don't fail webhook if print fails
      }
    }

    // Handle payment failures
    if (event.type === 'payment_intent.payment_failed') {
      const paymentIntent = event.data.object as any;

      console.error('Payment failed:', {
        paymentIntentId: paymentIntent.id,
        error: paymentIntent.last_payment_error?.message,
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
