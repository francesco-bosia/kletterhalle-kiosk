'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import { hasDailyPass, hasShowerOnly } from '@/lib/cart-rules';
import { StepTitle } from '@/components/wizard/StepTitle';
import type { CartLine } from '@/lib/cart';

export function Step3Summary() {
  const { state } = useWizard();
  const { cart, lang } = state;

  const activeItems = cart.filter((l) => l.quantity > 0);
  const total = cartTotal(cart);
  const showShowerHint = hasDailyPass(cart) && !hasShowerOnly(cart);

  return (
    <div className="flex flex-col gap-4">
      <StepTitle
        it="Riepilogo"
        en="Summary"
        descriptionIt="Controlla il tuo ordine prima di procedere."
        descriptionEn="Review your order before proceeding."
      />

      {/* Line items */}
      <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {activeItems.map((line) => (
          <div
            key={line.productId}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-base font-medium text-black">
              {lang === 'it' ? line.labelIt : line.labelEn}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-gray-400">x{line.quantity}</span>
              <span className="text-base font-bold tabular-nums text-black">
                {formatChf(line.priceCents * line.quantity)}
              </span>
            </div>
          </div>
        ))}

        {/* Grand total */}
        <div className="flex items-center justify-between px-4 py-4 bg-black rounded-b-2xl">
          <span className="text-base font-bold text-white">
            Totale / Total
          </span>
          <span className="text-2xl font-bold tabular-nums text-white">
            {formatChf(total)}
          </span>
        </div>
      </div>

      {/* Shower included hint */}
      {showShowerHint && (
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            La doccia è inclusa con la giornaliera
            <br />
            <span className="text-gray-400">
              Shower is included with your daily pass
            </span>
          </p>
        </div>
      )}

      {/* Payment notice */}
      <div className="rounded-xl border border-gray-200 px-4 py-3">
        <p className="text-sm text-gray-500">
          Pagamento con TWINT, carta di credito o carta prepagata
          <br />
          <span className="text-gray-400">
            Payment via TWINT, credit card or prepaid card
          </span>
        </p>
      </div>
    </div>
  );
}
