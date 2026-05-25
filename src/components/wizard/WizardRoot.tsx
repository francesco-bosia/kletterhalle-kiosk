'use client';

import { Suspense, useEffect, useReducer } from 'react';
import { useSearchParams } from 'next/navigation';
import { wizardReducer, createInitialState } from '@/lib/wizard';
import { WizardReactContext } from '@/lib/wizard-context';
import { TerminalProvider } from '@/components/terminal-provider';
import { WizardChrome } from '@/components/wizard/WizardChrome';

/**
 * Detects a TWINT return redirect from URL search params.
 * Must be used inside a Suspense boundary because it calls useSearchParams().
 */
function TwintReturnDetector({ dispatch }: { dispatch: React.Dispatch<import('@/lib/wizard').WizardAction> }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const twintReturn = searchParams.get('twint_return');
    if (twintReturn === 'true') {
      dispatch({ type: 'PAYMENT_SUCCEEDED', transactionId: 'twint-return' });
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
