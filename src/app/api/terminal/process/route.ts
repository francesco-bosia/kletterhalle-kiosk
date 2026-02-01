import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/terminal/process
 *
 * Processes a payment through a Stripe Terminal card reader.
 * This endpoint is used when the kiosk has a physical Stripe Terminal
 * (Reader M2 or S700) connected for in-person card payments.
 *
 * Note: In production, you would use the Stripe Terminal SDK
 * directly on the client side to discover readers and process payments.
 * This server-side endpoint is for creating terminal connection tokens
 * and handling any server-side terminal operations.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, paymentIntentId } = body;

    const stripe = getStripe();
    const locationId = process.env.STRIPE_TERMINAL_LOCATION_ID;

    if (!locationId) {
      return NextResponse.json(
        { error: 'STRIPE_TERMINAL_LOCATION_ID not configured' },
        { status: 500 }
      );
    }

    if (action === 'create_connection_token') {
      // Create a connection token for the Terminal SDK
      // This allows the client to connect to a reader
      const connectionToken = await stripe.terminal.connectionTokens.create();

      return NextResponse.json({
        secret: connectionToken.secret,
      });
    }

    if (action === 'process_payment' && paymentIntentId) {
      // In a real implementation, the payment would be processed
      // by the Terminal SDK on the client side.
      // This endpoint can be used to verify the payment intent status.

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

      return NextResponse.json({
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
      });
    }

    if (action === 'list_readers') {
      // List available readers at the configured location
      const readers = await stripe.terminal.readers.list({
        location: locationId,
        limit: 10,
      });

      return NextResponse.json({
        readers: readers.data,
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error processing terminal request:', error);
    return NextResponse.json(
      { error: 'Failed to process terminal request' },
      { status: 500 }
    );
  }
}
