import { NextRequest, NextResponse } from 'next/server';
import { printThermalReceipt } from '@/lib/printer';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, total, transactionId, paymentMethod } = body;

    // Validate request
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'No items to print' },
        { status: 400 }
      );
    }

    if (!total || !transactionId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Missing required fields: total, transactionId, paymentMethod' },
        { status: 400 }
      );
    }

    // Print receipt
    await printThermalReceipt({
      items,
      total,
      transactionId,
      paymentMethod,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Print error:', error);
    return NextResponse.json(
      {
        error: 'Failed to print receipt',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
