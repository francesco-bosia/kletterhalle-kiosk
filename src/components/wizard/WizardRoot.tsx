'use client';

import { Suspense, useEffect, useReducer } from 'react';
import { useSearchParams } from 'next/navigation';
import { wizardReducer, createInitialState } from '@/lib/wizard';
import { WizardReactContext } from '@/lib/wizard-context';
import { TerminalProvider } from '@/components/terminal-provider';
import { WizardChrome } from '@/components/wizard/WizardChrome';
import { completePayment, takePendingCompletion } from '@/lib/completion-client';

/**
 * Detects a TWINT return redirect from URL search params.
 * Must be used inside a Suspense boundary because it calls useSearchParams().
 */
function TwintReturnDetector({ dispatch }: { dispatch: React.Dispatch<import('@/lib/wizard').WizardAction> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const twintReturn = searchParams.get('twint_return');
    if (twintReturn === 'true') {
      // Read-and-remove the stashed completion so it replays at most once
      // (guards against StrictMode double-invoke and manual refreshes).
      const pending = takePendingCompletion();
      if (pending) completePayment(pending);
      dispatch({
        type: 'PAYMENT_SUCCEEDED',
        transactionId: pending?.print.transactionId ?? 'twint-return',
      });
      // Clean the URL without a full page reload
      window.history.replaceState({}, '', '/');
    }
  }, [searchParams, dispatch]);

  return null;
}

export default function WizardRoot() {
  const [state, dispatch] = useReducer(wizardReducer, createInitialState());

  return (
    <WizardReactContext.Provider value={{ state, dispatch }}>
      <TerminalProvider>
        <Suspense fallback={null}>
          <TwintReturnDetector dispatch={dispatch} />
        </Suspense>
        <WizardChrome />
      </TerminalProvider>
    </WizardReactContext.Provider>
  );
}
