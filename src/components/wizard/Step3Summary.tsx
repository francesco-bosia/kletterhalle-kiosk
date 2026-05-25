'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import type { CartLine } from '@/lib/cart';

const DAILY_PASS_IDS = ['adult', 'student', 'teen', 'child', 'family'];
const DAILY_GROUP_ID = 'daily';
const SHOWER_ID = 'shower';

function hasDailyPass(cart: CartLine[]): boolean {
  return cart.some(
    (l) =>
      l.quantity > 0 &&
      (DAILY_PASS_IDS.includes(l.productId) || l.groupId === DAILY_GROUP_ID)
  );
}

function hasShowerOnly(cart: CartLine[]): boolean {
  return cart.some((l) => l.quantity > 0 && l.productId === SHOWER_ID);
}

export function Step3Summary() {
  const { state } = useWizard();
  const { cart, lang } = state;

  const activeItems = cart.filter((l) => l.quantity > 0);
  const total = cartTotal(cart);
  const showShowerHint = hasDailyPass(cart) && !hasShowerOnly(cart);

  return (
    <div className="flex flex-col gap-4 px-5 py-2">
      {/* Title section */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-black">
          {lang === 'it' ? 'Riepilogo' : 'Summary'}
        </h1>
        <p className="mt-1 text-sm text-gray-400 italic">
          {lang === 'en' ? 'Riepilogo' : 'Summary'}
        </p>
        <p className="mt-3 text-sm text-gray-400 text-center">
          Controlla il tuo ordine prima di procedere.
          <br />
          Review your order before proceeding.
        </p>
      </div>

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
