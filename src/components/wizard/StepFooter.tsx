'use client';

import { useWizard } from '@/lib/wizard-context';
import { LAST_SHOPPING_STEP, isContinueDisabled } from '@/lib/wizard';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';

export function StepFooter() {
  const { state, dispatch } = useWizard();
  const { step, cart, view } = state;

  const total = cartTotal(cart);
  const continueDisabled = isContinueDisabled(view, step, total);

  // Bilingual button labels — Italian primary (top), English secondary (below)
  const buttonLabels = {
    1: { it: 'Continua', en: 'Continue' },
    2: { it: 'Continua', en: 'Continue' },
    3: { it: 'Pagamento', en: 'Payment' },
    4: { it: 'Pagamento', en: 'Payment' },
  };

  const currentLabel = buttonLabels[step as keyof typeof buttonLabels];

  function handleContinue() {
    if (continueDisabled) return;
    const nextStep =
      view === 'penalty' && step <= LAST_SHOPPING_STEP ? 3 : ((step + 1) as 1 | 2 | 3 | 4);
    dispatch({ type: 'GO_TO_STEP', step: nextStep });
  }

  return (
    <footer className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4">
      <div className="flex items-center justify-between gap-4">
        {/* Running total */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold text-black">
            Totale{' '}
            <span className="italic font-normal text-gray-400">Total</span>
          </span>
          <span className="text-2xl font-black tabular-nums text-black leading-tight">
            {formatChf(total)}
          </span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={continueDisabled}
          className={`rounded-3xl px-8 py-3 transition-colors flex flex-col items-center shrink-0 ${
            continueDisabled
              ? 'cursor-not-allowed bg-gray-100'
              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
          }`}
        >
          <span className={`text-lg font-bold leading-tight ${continueDisabled ? 'text-gray-300' : 'text-white'}`}>
            {currentLabel.it}
          </span>
          <span className={`text-sm italic font-medium leading-tight ${continueDisabled ? 'text-gray-400' : 'text-white/90'}`}>
            {currentLabel.en}
          </span>
        </button>
      </div>
    </footer>
  );
}
