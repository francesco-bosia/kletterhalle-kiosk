import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  triggerPrint,
  logTransaction,
  completePayment,
  stashPendingCompletion,
  takePendingCompletion,
  discardPendingCompletion,
  type CompletionPayload,
} from '@/lib/completion-client';

const sample: CompletionPayload = {
  print: {
    items: [{ name: 'Biglietto adulto', quantity: 2, price: 700 }],
    total: 1400,
    transactionId: 'pi_123',
    paymentMethod: 'Carta',
    lang: 'it',
  },
  log: {
    items: [{ ticketId: 'adult', ticketName: 'Biglietto adulto', quantity: 2, price: 700 }],
    total: 1400,
    paymentMethod: 'card',
    stripeIds: { paymentIntent: 'pi_123' },
  },
};

function makeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal('window', { localStorage: makeLocalStorage() });
});

describe('stash/take pending completion', () => {
  it('round-trips a payload', () => {
    stashPendingCompletion(sample);
    expect(takePendingCompletion()).toEqual(sample);
  });

  it('returns null when nothing is stashed', () => {
    expect(takePendingCompletion()).toBeNull();
  });

  it('returns the payload at most once (read-and-remove)', () => {
    stashPendingCompletion(sample);
    expect(takePendingCompletion()).toEqual(sample);
    expect(takePendingCompletion()).toBeNull();
  });

  it('discardPendingCompletion removes a stashed payload without replaying it', () => {
    stashPendingCompletion(sample);
    discardPendingCompletion();
    expect(takePendingCompletion()).toBeNull();
  });
});

describe('triggerPrint / logTransaction', () => {
  it('triggerPrint POSTs to /api/print', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await triggerPrint(sample.print);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/print',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(sample.print) })
    );
  });

  it('logTransaction POSTs to /api/transactions/log', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => '' });
    vi.stubGlobal('fetch', fetchMock);
    await logTransaction(sample.log);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/transactions/log',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(sample.log) })
    );
  });

  it('never throws when a request rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    await expect(triggerPrint(sample.print)).resolves.toBeUndefined();
    await expect(logTransaction(sample.log)).resolves.toBeUndefined();
  });
});

describe('completePayment', () => {
  it('fires both print and log', async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        calls.push(url);
        return Promise.resolve({ ok: true, text: async () => '' });
      })
    );
    completePayment(sample);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls).toContain('/api/print');
    expect(calls).toContain('/api/transactions/log');
  });
});
