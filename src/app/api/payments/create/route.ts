import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

interface CartItemRequest {
  ticketId: string;
  ticketName: string;
  price: number;
  quantity: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, total, paymentMethod } = body;

    // Validate request
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Cart is empty or invalid' },
        { status: 400 }
      );
    }

    if (!total || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: total, paymentMethod' },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    if (paymentMethod === 'card') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: total,
        currency: 'chf',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          cartData: JSON.stringify(items),
          itemCount: items.reduce((sum: number, item: CartItemRequest) => sum + item.quantity, 0).toString(),
        },
        description: `Kletterhalle: ${items.length} ticket type(s)`,
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        cartItems: items,
      });
    }

    if (paymentMethod === 'twint') {
      const checkoutSession = await stripe.checkout.sessions.create({
        payment_method_types: ['twint'],
        line_items: items.map((item: CartItemRequest) => ({
          price_data: {
            currency: 'chf',
            product_data: {
              name: item.ticketName,
            },
            unit_amount: item.price,
          },
          quantity: item.quantity,
        })),
        mode: 'payment',
        success_url: `${baseUrl}/success?total=${total}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          cartData: JSON.stringify(items),
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
