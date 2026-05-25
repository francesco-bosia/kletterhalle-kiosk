'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWizard } from '@/lib/wizard-context';

const COUNTDOWN_SECONDS = 10;

export function Step4Success() {
  const { state, dispatch } = useWizard();
  const { payment } = state;
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'RESET_SESSION' });
  }, [dispatch]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          queueMicrotask(() => dispatch({ type: 'RESET_SESSION' }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
      {/* Checkmark icon */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-12 w-12 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Pagamento riuscito!
        </h2>
        <p className="mt-1 text-base text-gray-600">
          Grazie e buona arrampicata!
        </p>
      </div>

      {/* Transaction ID */}
      {payment.transactionId && (
        <p className="text-sm text-gray-500">
          ID transazione: {payment.transactionId}
        </p>
      )}

      {/* Restart button */}
      <button
        onClick={resetSession}
        className="rounded-xl bg-black px-8 py-3 text-base font-bold text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
      >
        Nuova sessione
      </button>

      {/* Countdown hint */}
      <p className="text-xs text-gray-400">
        Ripartimento automatico tra {remaining} secondi
      </p>
    </div>
  );
}
