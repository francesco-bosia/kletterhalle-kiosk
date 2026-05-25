'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import { t } from '@/lib/i18n';

export function StepFooter() {
  const { state, dispatch } = useWizard();
  const { step, cart, lang } = state;

  const total = cartTotal(cart);
  const isContinueDisabled = step === 1 && total === 0;

  function getButtonLabel(): string {
    if (step === 3) return t('steps.payment', lang);
    return t('chrome.continueLabel', lang);
  }

  function handleContinue() {
    if (isContinueDisabled) return;
    const nextStep = (step + 1) as 1 | 2 | 3 | 4;
    dispatch({ type: 'GO_TO_STEP', step: nextStep });
  }

  return (
    <footer className="sticky bottom-0 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        {/* Running total */}
        <div className="flex flex-col">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            Totale / Total
          </span>
          <span className="text-2xl font-bold text-black">
            {formatChf(total)}
          </span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={`rounded-xl px-8 py-3 text-base font-bold tracking-wide transition-colors ${
            isContinueDisabled
              ? 'cursor-not-allowed bg-gray-100 text-gray-300'
              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
          }`}
        >
          {getButtonLabel()}
        </button>
      </div>
    </footer>
  );
}
