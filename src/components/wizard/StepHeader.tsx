'use client';

import { useWizard } from '@/lib/wizard-context';

const TOTAL_STEPS = 4 as const;

export function StepHeader() {
  const { state, dispatch } = useWizard();
  const { step, phase } = state;

  const isDisabled = phase === 'processing' || phase === 'success' || phase === 'failed';

  function goToStep(targetStep: 1 | 2 | 3 | 4) {
    if (isDisabled) return;
    if (targetStep >= step) return; // Can't jump forward
    dispatch({ type: 'GO_TO_STEP', step: targetStep });
  }

  return (
    <header className="flex items-center justify-center px-5 py-4 gap-3">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = (i + 1) as 1 | 2 | 3 | 4;
        const isActive = step === stepNum;
        const isPast = stepNum < step;

        if (isActive) {
          return (
            <button
              key={stepNum}
              disabled={isDisabled}
              className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase bg-black text-white cursor-default"
            >
              STEP {stepNum}
            </button>
          );
        }

        if (isPast) {
          return (
            <button
              key={stepNum}
              onClick={() => goToStep(stepNum)}
              disabled={isDisabled}
              className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase bg-gray-200 text-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              STEP {stepNum}
            </button>
          );
        }

        return (
          <button
            key={stepNum}
            disabled
            className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase border border-gray-200 text-gray-300 cursor-not-allowed"
          >
            STEP {stepNum}
          </button>
        );
      })}
    </header>
  );
}
