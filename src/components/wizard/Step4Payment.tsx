'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { toPaymentsCreatePayload } from '@/lib/cart';

import { t } from '@/lib/i18n';
import { Step4Success } from '@/components/wizard/Step4Success';

const TAP_TIMEOUT_MS = 30_000; // spec: 30s tap window
const CANCEL_GRACE_MS = 10_000; // spec: grace when cancel hits a busy reader
const PAYMENT_POLL_MS = 1_000;
const READER_POLL_MS = 10_000;

function declineMessage(code: string | null, lang: 'it' | 'en'): string {
  // failure codes are not for display logic per Stripe docs — one friendly
  // message regardless of decline reason.
  void code;
  return t('payment.declined', lang);
}

export function Step4Payment() {
  const { state, dispatch } = useWizard();
  const { phase, payment, cart, lang } = state;

  // Guard against double-clicks / concurrent flows
  const flowInProgress = useRef(false);

  // ── Reader availability (card screen, pre-payment) ─────────────────────────
  const [readerOnline, setReaderOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (payment.method !== 'card' || phase !== 'shopping') return;
    let active = true;
    const check = async () => {
      try {
        const res = await fetch('/api/terminal/state');
        const data = await res.json();
        if (active) setReaderOnline(res.ok ? data.readerOnline === true : false);
      } catch {
        if (active) setReaderOnline(false);
      }
    };
    void check();
    const id = setInterval(() => void check(), READER_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [payment.method, phase]);

  // ── Payment polling: 1 Hz while paying; 30s timeout; cancel with grace ─────
  const cancelRequested = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (payment.method !== 'card' || phase !== 'paying' || !payment.paymentIntentId) {
      setSecondsLeft(null);
      return;
    }
    const piId = payment.paymentIntentId;
    let active = true;
    cancelRequested.current = false;
    const startedAt = Date.now();
    let graceDeadline: number | null = null;
    let busySeen = false;
    let tickRunning = false;
    setSecondsLeft(Math.ceil(TAP_TIMEOUT_MS / 1000));

    const stop = (fn: () => void) => {
      if (!active) return;
      active = false;
      fn();
    };

    const requestCancel = async () => {
      try {
        const res = await fetch('/api/terminal/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: piId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(String(data.error));
        if (data.busy) {
          if (busySeen) {
            // Second busy after the grace window — something is stuck.
            stop(() => dispatch({ type: 'PAYMENT_FAILED', error: t('payment.terminalError', lang) }));
            return;
          }
          busySeen = true;
          graceDeadline = Date.now() + CANCEL_GRACE_MS;
          return; // keep polling: a charge that lands wins over the cancel
        }
        if (data.state === 'succeeded') {
          stop(() => dispatch({ type: 'PAYMENT_SUCCEEDED', transactionId: piId }));
        } else {
          stop(() => dispatch({ type: 'RETRY_PAYMENT' })); // back to method picker
        }
      } catch {
        stop(() => dispatch({ type: 'PAYMENT_FAILED', error: t('payment.terminalError', lang) }));
      }
    };

    const tick = async () => {
      if (!active || tickRunning) return;
      tickRunning = true;
      try {
        const elapsed = Date.now() - startedAt;
        setSecondsLeft(Math.max(0, Math.ceil((TAP_TIMEOUT_MS - elapsed) / 1000)));

        const wantsCancel = cancelRequested.current || elapsed >= TAP_TIMEOUT_MS;
        const inGrace = graceDeadline !== null && Date.now() < graceDeadline;
        if (wantsCancel && !inGrace) {
          await requestCancel();
          if (!active) return;
          if (graceDeadline !== null && Date.now() < graceDeadline) {
            // just entered grace — fall through to a state poll below
          } else {
            return;
          }
        }

        try {
          const res = await fetch(`/api/terminal/state?paymentIntentId=${piId}`);
          if (!res.ok) return; // transient — keep polling
          const data = await res.json();
          if (!active) return;
          if (data.state === 'succeeded') {
            stop(() => dispatch({ type: 'PAYMENT_SUCCEEDED', transactionId: piId }));
          } else if (data.state === 'declined') {
            stop(() =>
              dispatch({ type: 'PAYMENT_FAILED', error: declineMessage(data.code ?? null, lang) })
            );
          } else if (data.state === 'canceled') {
            stop(() => dispatch({ type: 'RETRY_PAYMENT' }));
          }
        } catch {
          // transient poll error — keep polling; the 30s timeout bounds the wait
        }
      } finally {
        tickRunning = false;
      }
    };

    const id = setInterval(() => void tick(), PAYMENT_POLL_MS);
    void tick();
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [payment.method, phase, payment.paymentIntentId, lang, dispatch]);

  // ── Card flow: create PI (unless retrying) and push it to the reader ───────
  const handleCardPayment = useCallback(
    async (existingPiId?: string) => {
      if (flowInProgress.current) return;
      flowInProgress.current = true;

      try {
        let piId = existingPiId ?? null;

        if (!piId) {
          const payload = toPaymentsCreatePayload(cart, lang, 'card');
          const res = await fetch('/api/payments/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (!res.ok || data.error) {
            dispatch({ type: 'PAYMENT_FAILED', error: data.error || 'Failed to create payment' });
            return;
          }
          piId = data.paymentIntentId as string;
        }

        const payRes = await fetch('/api/terminal/pay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentIntentId: piId }),
        });
        const payData = await payRes.json();

        if (!payRes.ok) {
          if (payData.error === 'payment-not-payable' && existingPiId) {
            // Stale PI from an earlier attempt (e.g. canceled by timeout):
            // start over with a fresh one. Await so the outer finally doesn't
            // reopen the reentrancy guard mid-flight; setting the flag false
            // first lets the inner guard pass synchronously (no gap).
            flowInProgress.current = false;
            await handleCardPayment();
            return;
          }
          dispatch({
            type: 'PAYMENT_FAILED',
            error: t(
              payData.error === 'reader-offline'
                ? 'payment.readerUnavailable'
                : 'payment.terminalError',
              lang
            ),
          });
          return;
        }

        // Reader is live — start polling (clientSecret is unused server-driven).
        dispatch({ type: 'PAYMENT_STARTED', paymentIntentId: piId, clientSecret: '' });
      } catch (err) {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: err instanceof Error ? err.message : 'Unexpected error',
        });
      } finally {
        flowInProgress.current = false;
      }
    },
    [cart, lang, dispatch]
  );

  const handleTwintPayment = useCallback(async () => {
    if (flowInProgress.current) return;
    flowInProgress.current = true;

    try {
      dispatch({ type: 'PAYMENT_STARTED', paymentIntentId: '', clientSecret: '' });

      const payload = toPaymentsCreatePayload(cart, lang, 'twint');
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        dispatch({ type: 'PAYMENT_FAILED', error: data.error || 'Failed to create TWINT session' });
        return;
      }

      // Redirect to Stripe Checkout. Fulfillment (print + log) is fully
      // server-side: the /success fast-path or the reconcile sweep.
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        dispatch({ type: 'PAYMENT_FAILED', error: 'No checkout URL received' });
      }
    } catch (err) {
      dispatch({
        type: 'PAYMENT_FAILED',
        error: err instanceof Error ? err.message : 'Unexpected error',
      });
    } finally {
      flowInProgress.current = false;
    }
  }, [cart, lang, dispatch]);

  // ── State 1: Success ────────────────────────────────────────────────────────
  if (phase === 'success') {
    return <Step4Success />;
  }

  // ── State 2: Failed ────────────────────────────────────────────────────────
  if (phase === 'failed') {
    const canRetrySamePi = payment.method === 'card' && !!payment.paymentIntentId;
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">{t('failed.title', lang)}</p>
          <p className="mt-2 text-sm text-gray-500">
            {payment.error || t('failed.errorMessage', lang)}
          </p>
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              if (canRetrySamePi) {
                // Re-process the SAME PaymentIntent (Stripe guidance: never
                // recreate a PI after a decline).
                dispatch({
                  type: 'PAYMENT_STARTED',
                  paymentIntentId: payment.paymentIntentId!,
                  clientSecret: '',
                });
                void handleCardPayment(payment.paymentIntentId!);
              } else {
                dispatch({ type: 'RETRY_PAYMENT' });
              }
            }}
            className="mt-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            {t('failed.retry', lang)}
          </button>
          {canRetrySamePi && (
            <button
              onClick={() => dispatch({ type: 'RETRY_PAYMENT' })}
              className="text-sm text-gray-500 underline"
            >
              {t('failed.changeMethod', lang)}
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── State 3: Method picker (phase === 'shopping' && no method chosen) ──────
  if (phase === 'shopping' && !payment.method) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <h2 className="text-xl font-bold text-gray-900">{t('payment.chooseMethod', lang)}</h2>

        <div className="grid w-full max-w-md grid-cols-2 gap-4">
          <button
            onClick={() => dispatch({ type: 'SET_METHOD', method: 'card' })}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-6 transition-colors hover:border-black hover:bg-gray-50 active:border-black active:bg-gray-100"
          >
            <svg
              className="h-12 w-12 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
              />
            </svg>
            <span className="text-base font-semibold text-gray-900">{t('payment.payWithCard', lang)}</span>
          </button>

          <button
            onClick={() => dispatch({ type: 'SET_METHOD', method: 'twint' })}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-6 transition-colors hover:border-black hover:bg-gray-50 active:border-black active:bg-gray-100"
          >
            <svg
              className="h-12 w-12 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
              />
            </svg>
            <span className="text-base font-semibold text-gray-900">{t('payment.payWithTwint', lang)}</span>
          </button>
        </div>
      </div>
    );
  }

  // ── State 4: Card payment flow ─────────────────────────────────────────────
  if (payment.method === 'card') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        {/* Reader status (server-checked; only meaningful pre-payment) */}
        {phase === 'shopping' && (
          <div className="flex items-center gap-3">
            <div
              className={`h-3 w-3 rounded-full ${
                readerOnline === false
                  ? 'bg-red-500'
                  : readerOnline === true
                    ? 'bg-green-500'
                    : 'animate-pulse bg-yellow-500'
              }`}
            />
            <span className="text-sm text-gray-600">
              {readerOnline === false
                ? t('payment.readerUnavailable', lang)
                : readerOnline === true
                  ? t('payment.readerConnected', lang)
                  : t('payment.checkingReader', lang)}
            </span>
          </div>
        )}

        {/* Card icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-10 w-10 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z"
            />
          </svg>
        </div>

        {/* Awaiting tap: prompt + countdown + cancel */}
        {phase === 'paying' && (
          <>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900">{t('payment.waitingPayment', lang)}</p>
              <p className="mt-1 text-sm text-gray-500">{t('payment.tapCard', lang)}</p>
            </div>

            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-sm text-gray-600">{t('payment.processing', lang)}</span>
            </div>

            <button
              onClick={() => {
                cancelRequested.current = true;
              }}
              className="rounded-xl border-2 border-gray-300 px-8 py-3 text-base font-semibold text-gray-700 transition-colors hover:border-gray-400 active:bg-gray-100"
            >
              {t('payment.cancelCountdown', lang)}
              {secondsLeft !== null ? ` (${secondsLeft}s)` : ''}
            </button>
          </>
        )}

        {/* Start payment */}
        {phase === 'shopping' && (
          <button
            onClick={() => void handleCardPayment()}
            disabled={readerOnline !== true}
            className={`rounded-xl px-8 py-3 text-base font-semibold transition-colors ${
              readerOnline === true
                ? 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
                : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            {t('payment.startPayment', lang)}
          </button>
        )}
      </div>
    );
  }

  // ── State 5: TWINT flow ────────────────────────────────────────────────────
  if (payment.method === 'twint') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-10 w-10 text-black"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125-1.125 0 01-1.125-1.125v-4.5z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
            />
          </svg>
        </div>

        <h2 className="text-xl font-bold text-gray-900">{t('payment.payWithTwint', lang)}</h2>

        {phase === 'shopping' && (
          <button
            onClick={handleTwintPayment}
            className="rounded-xl bg-black px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-gray-800 active:bg-gray-700"
          >
            {lang === 'it' ? 'Vai al pagamento' : 'Proceed to payment'}
          </button>
        )}

        {phase === 'paying' && (
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 animate-spin text-black"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
            <span className="text-sm text-gray-600">{t('payment.processing', lang)}</span>
          </div>
        )}
      </div>
    );
  }

  // Fallback — should not reach here
  return null;
}
