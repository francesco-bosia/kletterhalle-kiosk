import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { appendTransactionLog } from '@/lib/transaction-log';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'txlog-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('appendTransactionLog', () => {
  it('appends one JSONL line with derived fields', async () => {
    await appendTransactionLog(
      {
        items: [{ ticketId: 'adult', ticketName: 'Biglietto adulto', quantity: 2, price: 700 }],
        total: 1400,
        paymentMethod: 'card',
        stripeIds: { paymentIntent: 'pi_1' },
      },
      dir
    );
    const dateStr = new Date().toISOString().split('T')[0];
    const lines = (await fs.readFile(path.join(dir, `${dateStr}.jsonl`), 'utf8'))
      .trim()
      .split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry).toMatchObject({
      date: dateStr,
      total: 1400,
      totalChf: 'CHF 14.00',
      paymentMethod: 'card',
      stripeIds: { paymentIntent: 'pi_1' },
    });
    expect(entry.timestamp).toBeTruthy();
  });

  it('appends (not overwrites) on subsequent calls', async () => {
    const payload = {
      items: [{ ticketId: 'adult', ticketName: 'Adult', quantity: 1, price: 700 }],
      total: 700,
      paymentMethod: 'twint',
      stripeIds: { checkoutSession: 'cs_1' },
    };
    await appendTransactionLog(payload, dir);
    await appendTransactionLog(payload, dir);
    const dateStr = new Date().toISOString().split('T')[0];
    const lines = (await fs.readFile(path.join(dir, `${dateStr}.jsonl`), 'utf8'))
      .trim()
      .split('\n');
    expect(lines).toHaveLength(2);
  });
});
