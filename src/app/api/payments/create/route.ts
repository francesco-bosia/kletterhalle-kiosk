import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { getProductById } from '@/lib/catalog';

interface CompactCartItem {
  id: string;
  qty: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, total, paymentMethod, lang } = body;

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

    // Expand compact items to get full product details (Italian names, prices)
    const expandedItems = items.map((item: CompactCartItem) => {
      const product = getProductById(item.id);
      if (!product) throw new Error(`Unknown product id: ${item.id}`);
      return {
        ticketId: item.id,
        ticketName: product.label.it,
        price: product.isFree ? 0 : product.priceCents,
        quantity: item.qty,
      };
    });

    // Compute total server-side from expanded items (defense-in-depth)
    const computedTotal = expandedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

    if (paymentMethod === 'card') {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: computedTotal,
        currency: 'chf',
        payment_method_types: ['card_present'],
        capture_method: 'automatic',
        metadata: {
          cartData: JSON.stringify(items), // Store compact shape
          itemCount: items.reduce((sum: number, item: CompactCartItem) => sum + item.qty, 0).toString(),
          totalCents: computedTotal.toString(),
          paymentMethod: 'card',
          lang: lang || 'it',
        },
        description: `Splüia: ${items.length} ticket type(s)`,
      });

      return NextResponse.json({
        paymentIntentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        cartItems: expandedItems,
      });
    }

    if (paymentMethod === 'twint') {
      const checkoutSession = await stripe.checkout.sessions.create({
        customer_email: 'kiosk@spluia.ch',
        payment_method_types: ['twint'],
        line_items: expandedItems.map((item) => ({
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
        success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/`,
        metadata: {
          cartData: JSON.stringify(items),
          itemCount: items.reduce((sum: number, item: CompactCartItem) => sum + item.qty, 0).toString(),
          totalCents: computedTotal.toString(),
          paymentMethod: 'twint',
          lang: lang || 'it',
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
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}
