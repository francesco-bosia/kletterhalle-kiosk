import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/terminal/connection-token
 *
 * Creates a connection token for the Stripe Terminal SDK.
 * The SDK uses this to connect to a reader (real or simulated).
 *
 * Required for: Stripe Terminal SDK initialization
 */
export async function POST(request: NextRequest) {
  try {
    const stripe = getStripe();

    // Create a connection token for the Terminal SDK
    // Tokens are short-lived (typically 30 minutes)
    const connectionToken = await stripe.terminal.connectionTokens.create();

    return NextResponse.json({
      secret: connectionToken.secret,
    });
  } catch (error) {
    console.error('Error creating connection token:', error);
    return NextResponse.json(
      { error: 'Failed to create connection token' },
      { status: 500 }
    );
  }
}
