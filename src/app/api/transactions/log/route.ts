import { NextRequest, NextResponse } from 'next/server';
import { appendTransactionLog } from '@/lib/transaction-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, total, paymentMethod, stripeIds } = body;
    await appendTransactionLog({ items, total, paymentMethod, stripeIds });
    return NextResponse.json({ success: true, logged: true });
  } catch (error) {
    console.error('Transaction log error:', error);
    return NextResponse.json(
      { error: 'Failed to log transaction' },
      { status: 500 }
    );
  }
}
