'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';

export function StepFooter() {
  const { state, dispatch } = useWizard();
  const { step, cart } = state;

  const total = cartTotal(cart);
  const isContinueDisabled = step === 1 && total === 0;

  // Bilingual button labels — Italian primary (top), English secondary (below)
  const buttonLabels = {
    1: { it: 'Continua', en: 'Continue' },
    2: { it: 'Continua', en: 'Continue' },
    3: { it: 'Pagamento', en: 'Payment' },
    4: { it: 'Pagamento', en: 'Payment' },
  };

  const currentLabel = buttonLabels[step as keyof typeof buttonLabels];

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
          <span className="text-xs font-bold text-black uppercase tracking-wider">
            Totale{' '}
            <span className="italic font-normal text-gray-400">Total</span>
          </span>
          <span className="text-4xl font-black tabular-nums text-black">
            {formatChf(total)}
          </span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={`rounded-2xl px-8 py-4 transition-colors flex flex-col items-center ${
            isContinueDisabled
              ? 'cursor-not-allowed bg-gray-100'
              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
          }`}
        >
          <span className={`text-xl font-bold ${isContinueDisabled ? 'text-gray-300' : 'text-white'}`}>
            {currentLabel.it}
          </span>
          <span className={`text-sm italic font-medium ${isContinueDisabled ? 'text-gray-400' : 'text-white/90'}`}>
            {currentLabel.en}
          </span>
        </button>
      </div>
    </footer>
  );
}
