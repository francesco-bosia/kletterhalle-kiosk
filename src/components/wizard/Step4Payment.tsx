'use client';

import { useCallback, useRef } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { useTerminal } from '@/components/terminal-provider';
import { toPaymentsCreatePayload, toPrintPayload, toTransactionLogPayload } from '@/lib/cart';
import { completePayment, stashPendingCompletion } from '@/lib/completion-client';

import { t } from '@/lib/i18n';
import { Step4Success } from '@/components/wizard/Step4Success';

export function Step4Payment() {
  const { state, dispatch } = useWizard();
  const { terminal, isConnected, error: terminalError } = useTerminal();
  const { phase, payment, cart, lang } = state;

  // Guard against double-clicks / concurrent flows
  const flowInProgress = useRef(false);

  // ── Hooks: must be called unconditionally before any early returns ─────────

  const handleCardPayment = useCallback(async () => {
    if (flowInProgress.current || !terminal) return;
    flowInProgress.current = true;

    try {
      // 1. Dispatch PAYMENT_STARTED with placeholder values
      dispatch({
        type: 'PAYMENT_STARTED',
        paymentIntentId: '',
        clientSecret: '',
      });

      // 2. Call POST /api/payments/create
      const payload = toPaymentsCreatePayload(cart, lang, 'card');
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: data.error || data.details || 'Failed to create payment',
        });
        return;
      }

      // Update with real values
      dispatch({
        type: 'PAYMENT_STARTED',
        paymentIntentId: data.paymentIntentId,
        clientSecret: data.clientSecret,
      });

      // 3. Collect payment method via Stripe Terminal
      const collectResult = await terminal.collectPaymentMethod(
        data.clientSecret
      );

      if ('error' in collectResult) {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: collectResult.error.message || 'Failed to collect payment method',
        });
        return;
      }

      // 4. Process payment
      const processResult = await terminal.processPayment(
        collectResult.paymentIntent
      );

      if ('error' in processResult) {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: processResult.error.message || 'Payment processing failed',
        });
        return;
      }

      // 5. Success — show the success screen, then fire the local completion
      // side-effects (print receipt + log transaction). Fire-and-forget: these
      // never throw, so a printer/log problem cannot disrupt the success UI.
      // The cart is still in memory here (PAYMENT_SUCCEEDED does not clear it;
      // RESET_SESSION does).
      const transactionId = processResult.paymentIntent.id;
      dispatch({ type: 'PAYMENT_SUCCEEDED', transactionId });
      completePayment({
        print: toPrintPayload(cart, {
          transactionId,
          paymentMethod: lang === 'it' ? 'Carta' : 'Card',
          lang,
        }),
        log: toTransactionLogPayload(cart, {
          paymentMethod: 'card',
          lang,
          stripeIds: { paymentIntent: transactionId },
        }),
      });
    } catch (err) {
      dispatch({
        type: 'PAYMENT_FAILED',
        error: err instanceof Error ? err.message : 'Unexpected error',
      });
    } finally {
      flowInProgress.current = false;
    }
  }, [terminal, cart, lang, dispatch]);

  const handleTwintPayment = useCallback(async () => {
    if (flowInProgress.current) return;
    flowInProgress.current = true;

    try {
      dispatch({
        type: 'PAYMENT_STARTED',
        paymentIntentId: '',
        clientSecret: '',
      });

      const payload = toPaymentsCreatePayload(cart, lang, 'twint');
      const res = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: data.error || data.details || 'Failed to create TWINT session',
        });
        return;
      }

      // Redirect to Stripe Checkout for TWINT payment
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        dispatch({
          type: 'PAYMENT_FAILED',
          error: 'No checkout URL received',
        });
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
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        {/* Error icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-10 w-10 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">
            {t('failed.title', lang)}
          </p>
          <p className="mt-2 text-sm text-gray-500">
            {payment.error || t('failed.errorMessage', lang)}
          </p>
        </div>

        <button
          onClick={() => dispatch({ type: 'RETRY_PAYMENT' })}
          className="mt-2 rounded-xl bg-blue-600 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          {t('failed.retry', lang)}
        </button>
      </div>
    );
  }

  // ── State 3: Method picker (phase === 'shopping' && no method chosen) ──────
  if (phase === 'shopping' && !payment.method) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        <h2 className="text-xl font-bold text-gray-900">
          {t('payment.chooseMethod', lang)}
        </h2>

        <div className="grid w-full max-w-md grid-cols-2 gap-4">
          {/* Card payment button */}
          <button
            onClick={() => dispatch({ type: 'SET_METHOD', method: 'card' })}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-6 transition-colors hover:border-black hover:bg-gray-50 active:border-black active:bg-gray-100"
          >
            {/* Card icon */}
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
            <span className="text-base font-semibold text-gray-900">
              {t('payment.payWithCard', lang)}
            </span>
          </button>

          {/* TWINT payment button */}
          <button
            onClick={() => dispatch({ type: 'SET_METHOD', method: 'twint' })}
            className="flex flex-col items-center gap-3 rounded-2xl border-2 border-gray-200 bg-white p-6 transition-colors hover:border-black hover:bg-gray-50 active:border-black active:bg-gray-100"
          >
            {/* TWINT-style icon (simplified QR code) */}
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
            <span className="text-base font-semibold text-gray-900">
              {t('payment.payWithTwint', lang)}
            </span>
          </button>
        </div>
      </div>
    );
  }

  // ── State 4: Card payment flow ─────────────────────────────────────────────
  if (payment.method === 'card') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        {/* Connection status */}
        <div className="flex items-center gap-3">
          <div
            className={`h-3 w-3 rounded-full ${
              terminalError
                ? 'bg-red-500'
                : isConnected
                  ? 'bg-green-500'
                  : 'animate-pulse bg-yellow-500'
            }`}
          />
          <span className="text-sm text-gray-600">
            {terminalError
              ? terminalError
              : isConnected
                ? (lang === 'it' ? 'Lettore collegato' : 'Reader connected')
                : (lang === 'it' ? 'Connessione al lettore...' : 'Connecting to reader...')}
          </span>
        </div>

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

        {/* Status message */}
        {phase === 'paying' && (
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {t('payment.waitingPayment', lang)}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {t('payment.tapCard', lang)}
            </p>
          </div>
        )}

        {/* Start payment button */}
        {phase === 'shopping' && (
          <button
            onClick={handleCardPayment}
            disabled={!isConnected || !!terminalError}
            className={`rounded-xl px-8 py-3 text-base font-semibold transition-colors ${
              isConnected && !terminalError
                ? 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
                : 'cursor-not-allowed bg-gray-300 text-gray-500'
            }`}
          >
            {lang === 'it' ? 'Avvia pagamento' : 'Start payment'}
          </button>
        )}

        {/* Processing spinner */}
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
            <span className="text-sm text-gray-600">
              {t('payment.processing', lang)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // ── State 5: TWINT flow ────────────────────────────────────────────────────
  if (payment.method === 'twint') {
    return (
      <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
        {/* TWINT icon */}
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

        <h2 className="text-xl font-bold text-gray-900">
          {t('payment.payWithTwint', lang)}
        </h2>

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
            <span className="text-sm text-gray-600">
              {t('payment.processing', lang)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Fallback — should not reach here
  return null;
}
