import { describe, it, expect, vi } from 'vitest';
import {
  getPaymentState,
  startPayment,
  cancelPayment,
  isReaderOnline,
  type StripeTerminalClient,
  type ReaderSnapshot,
} from '@/lib/terminal-payment';

const READER = 'tmr_test';
const PI = 'pi_123';

function reader(overrides: Partial<ReaderSnapshot> = {}): ReaderSnapshot {
  return { id: READER, status: 'online', action: null, ...overrides };
}

function action(
  status: string,
  opts: { pi?: string; failure_code?: string | null } = {}
): ReaderSnapshot['action'] {
  return {
    type: 'process_payment_intent',
    status,
    failure_code: opts.failure_code ?? null,
    process_payment_intent: { payment_intent: opts.pi ?? PI },
  };
}

function fakeStripe(opts: {
  reader?: ReaderSnapshot;
  piStatus?: string;
  processError?: { code?: string };
  cancelActionError?: { code?: string };
  piCancelError?: boolean;
}): StripeTerminalClient {
  return {
    terminal: {
      readers: {
        retrieve: vi.fn(async () => opts.reader ?? reader()),
        processPaymentIntent: vi.fn(async () => {
          if (opts.processError) throw opts.processError;
          return {};
        }),
        cancelAction: vi.fn(async () => {
          if (opts.cancelActionError) throw opts.cancelActionError;
          return {};
        }),
      },
    },
    paymentIntents: {
      retrieve: vi.fn(async () => ({ id: PI, status: opts.piStatus ?? 'requires_payment_method' })),
      cancel: vi.fn(async () => {
        if (opts.piCancelError) throw { code: 'payment_intent_unexpected_state' };
        return {};
      }),
    },
  };
}

describe('isReaderOnline', () => {
  it('true when reader online', async () => {
    expect(await isReaderOnline(fakeStripe({}), READER)).toBe(true);
  });
  it('false when reader offline', async () => {
    expect(
      await isReaderOnline(fakeStripe({ reader: reader({ status: 'offline' }) }), READER)
    ).toBe(false);
  });
});

describe('getPaymentState', () => {
  const noop = vi.fn();

  it('waiting while reader action for this PI is in_progress', async () => {
    const s = fakeStripe({ reader: reader({ action: action('in_progress') }) });
    expect(await getPaymentState(s, READER, PI, noop)).toEqual({ state: 'waiting' });
    // Must not even retrieve the PI — the action answers it.
    expect(s.paymentIntents.retrieve).not.toHaveBeenCalled();
  });

  it('declined with failure code when reader action failed', async () => {
    const s = fakeStripe({
      reader: reader({ action: action('failed', { failure_code: 'card_declined' }) }),
    });
    expect(await getPaymentState(s, READER, PI, noop)).toEqual({
      state: 'declined',
      code: 'card_declined',
    });
  });

  it('ignores reader action belonging to a different PI', async () => {
    const s = fakeStripe({
      reader: reader({ action: action('failed', { pi: 'pi_other' }) }),
      piStatus: 'requires_payment_method',
    });
    expect(await getPaymentState(s, READER, PI, noop)).toEqual({ state: 'waiting' });
  });

  it('succeeded fires onSucceeded exactly once with the PI id', async () => {
    const onSucceeded = vi.fn();
    const s = fakeStripe({
      reader: reader({ action: action('succeeded') }),
      piStatus: 'succeeded',
    });
    expect(await getPaymentState(s, READER, PI, onSucceeded)).toEqual({ state: 'succeeded' });
    expect(onSucceeded).toHaveBeenCalledTimes(1);
    expect(onSucceeded).toHaveBeenCalledWith(PI);
  });

  it('does not fire onSucceeded for non-succeeded PI', async () => {
    const onSucceeded = vi.fn();
    const s = fakeStripe({ piStatus: 'canceled' });
    expect(await getPaymentState(s, READER, PI, onSucceeded)).toEqual({ state: 'canceled' });
    expect(onSucceeded).not.toHaveBeenCalled();
  });

  it('waiting when no action and PI still requires_payment_method', async () => {
    const s = fakeStripe({});
    expect(await getPaymentState(s, READER, PI, noop)).toEqual({ state: 'waiting' });
  });
});

describe('startPayment', () => {
  it('ok on success, passes enable_customer_cancellation', async () => {
    const s = fakeStripe({});
    expect(await startPayment(s, READER, PI)).toEqual({ ok: true });
    expect(s.terminal.readers.processPaymentIntent).toHaveBeenCalledWith(READER, {
      payment_intent: PI,
      process_config: { enable_customer_cancellation: true },
    });
  });

  it.each([
    ['terminal_reader_offline', 'reader-offline'],
    ['terminal_reader_busy', 'reader-busy'],
    ['payment_intent_unexpected_state', 'payment-not-payable'],
    ['something_else', 'terminal-error'],
  ])('maps stripe code %s to %s', async (code, expected) => {
    const s = fakeStripe({ processError: { code } });
    expect(await startPayment(s, READER, PI)).toEqual({ ok: false, error: expected });
  });
});

describe('cancelPayment', () => {
  it('busy when reader is mid-authorization', async () => {
    const s = fakeStripe({ cancelActionError: { code: 'terminal_reader_busy' } });
    expect(await cancelPayment(s, READER, PI)).toEqual({ busy: true });
    expect(s.paymentIntents.cancel).not.toHaveBeenCalled();
  });

  it('cancels the PI even when cancelAction has nothing to cancel', async () => {
    const s = fakeStripe({ cancelActionError: { code: 'invalid_request' } });
    expect(await cancelPayment(s, READER, PI)).toEqual({ busy: false, state: 'canceled' });
    expect(s.paymentIntents.cancel).toHaveBeenCalled();
  });

  it('reports succeeded when PI cancel fails because the charge landed', async () => {
    const s = fakeStripe({ piCancelError: true, piStatus: 'succeeded' });
    expect(await cancelPayment(s, READER, PI)).toEqual({ busy: false, state: 'succeeded' });
  });

  it('reports canceled when PI cancel fails because it was already canceled', async () => {
    const s = fakeStripe({ piCancelError: true, piStatus: 'canceled' });
    expect(await cancelPayment(s, READER, PI)).toEqual({ busy: false, state: 'canceled' });
  });
});
