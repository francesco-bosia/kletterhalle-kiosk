'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import { t } from '@/lib/i18n';

interface StepFooterProps {
  /** Override the continue button label (rarely needed) */
  continueLabel?: string;
}

export function StepFooter({ continueLabel }: StepFooterProps) {
  const { state, dispatch } = useWizard();
  const { step, cart, lang } = state;

  const total = cartTotal(cart);
  const isContinueDisabled = step === 1 && total === 0;

  function getButtonLabel(): string {
    if (continueLabel) return continueLabel;
    if (step === 3) {
      return t('steps.payment', lang);
    }
    return t('chrome.continueLabel', lang);
  }

  function handleContinue() {
    if (isContinueDisabled) return;
    const nextStep = (step + 1) as 1 | 2 | 3 | 4;
    dispatch({ type: 'GO_TO_STEP', step: nextStep });
  }

  return (
    <footer className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Running total */}
        <div className="flex flex-col">
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {t('cart.total', lang)}
          </span>
          <span className="text-lg font-bold text-gray-900">
            {formatChf(total)}
          </span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={`rounded-xl px-6 py-3 text-sm font-semibold transition-colors ${
            isContinueDisabled
              ? 'cursor-not-allowed bg-gray-200 text-gray-400'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
          }`}
        >
          {getButtonLabel()}
        </button>
      </div>
    </footer>
  );
}
