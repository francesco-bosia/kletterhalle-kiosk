import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getTicketById } from '@/lib/tickets';

/**
 * POST /api/payments/create
 *
 * Creates a Stripe PaymentIntent for the selected ticket.
 * Supports both card payments (via Terminal) and TWINT.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ticketId, amount, paymentMethod } = body;

    // Validate request
    if (!ticketId || !amount || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: ticketId, amount, paymentMethod' },
        { status: 400 }
      );
    }

    // Verify ticket exists and amount matches
    const ticket = getTicketById(ticketId);
    if (!ticket) {
      return NextResponse.json(
        { error: 'Invalid ticket ID' },
        { status: 400 }
      );
    }

    if (ticket.price !== amount) {
      return NextResponse.json(
        { error: 'Amount does not match ticket price' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    if (paymentMethod === 'card') {
      // For card payments - create PaymentIntent for Stripe Terminal
      // The Terminal SDK will use this to process the payment on the reader
      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: 'chf',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          ticketId,
          ticketName: ticket.name,
        },
        description: `Kletterhalle: ${ticket.name}`,
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
      });
    }

    if (paymentMethod === 'twint') {
      // For TWINT payments - use Stripe Checkout
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['twint'],
        line_items: [
          {
            price_data: {
              currency: 'chf',
              product_data: {
                name: ticket.name,
                description: ticket.description,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${baseUrl}/success?ticket=${ticketId}&session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/payment?ticket=${ticketId}`,
        metadata: {
          ticketId,
          ticketName: ticket.name,
        },
      });

      return NextResponse.json({
        checkoutUrl: checkoutSession.url,
        sessionId: checkoutSession.id,
      });
    }

    return NextResponse.json(
      { error: 'Invalid payment method' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    // Log Stripe-specific errors
    if (error && typeof error === 'object' && 'type' in error) {
      console.error('Stripe error:', JSON.stringify(error, null, 2));
    }
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
