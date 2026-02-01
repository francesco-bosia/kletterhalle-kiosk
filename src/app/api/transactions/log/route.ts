import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

interface TransactionLog {
  timestamp: string;
  date: string;
  items: Array<{
    ticketId: string;
    ticketName: string;
    quantity: number;
    price: number;
  }>;
  total: number;
  totalChf: string;
  paymentMethod: string;
  stripeIds: {
    paymentIntent?: string;
    checkoutSession?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, total, paymentMethod, stripeIds } = body;

    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];

    const log: TransactionLog = {
      timestamp: now.toISOString(),
      date: dateStr,
      items,
      total,
      totalChf: `CHF ${(total / 100).toFixed(2)}`,
      paymentMethod,
      stripeIds,
    };

    const logDir = path.join(process.cwd(), 'transactions');
    await fs.mkdir(logDir, { recursive: true });

    const logFile = path.join(logDir, `${dateStr}.jsonl`);
    await fs.appendFile(logFile, JSON.stringify(log) + '\n');

    return NextResponse.json({ success: true, logged: true });
  } catch (error) {
    console.error('Transaction log error:', error);
    return NextResponse.json(
      { error: 'Failed to log transaction' },
      { status: 500 }
    );
  }
}
