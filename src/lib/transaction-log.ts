import { promises as fs } from 'fs';
import path from 'path';
import type { TransactionLogPayload } from '@/lib/cart';

/**
 * Append a transaction to the local JSONL audit log
 * (transactions/<date>.jsonl). Extracted from the API route so the
 * server-side fulfillment engine can call it directly.
 */
export async function appendTransactionLog(
  payload: TransactionLogPayload,
  logDir: string = path.join(process.cwd(), 'transactions')
): Promise<void> {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const entry = {
    timestamp: now.toISOString(),
    date: dateStr,
    items: payload.items,
    total: payload.total,
    totalChf: `CHF ${(payload.total / 100).toFixed(2)}`,
    paymentMethod: payload.paymentMethod,
    stripeIds: payload.stripeIds,
  };
  await fs.mkdir(logDir, { recursive: true });
  await fs.appendFile(
    path.join(logDir, `${dateStr}.jsonl`),
    JSON.stringify(entry) + '\n'
  );
}
