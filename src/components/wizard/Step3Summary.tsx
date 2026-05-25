'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import type { CartLine } from '@/lib/cart';

/** Product IDs that count as daily passes */
const DAILY_PASS_IDS = ['adult', 'student', 'teen', 'child', 'family'];

/** Group ID for the daily pass group */
const DAILY_GROUP_ID = 'daily';

/** Product ID for shower-only */
const SHOWER_ID = 'shower';

function hasDailyPass(cart: CartLine[]): boolean {
  return cart.some(
    (l) =>
      l.quantity > 0 &&
      (DAILY_PASS_IDS.includes(l.productId) || l.groupId === DAILY_GROUP_ID)
  );
}

function hasShowerOnly(cart: CartLine[]): boolean {
  return cart.some(
    (l) => l.quantity > 0 && l.productId === SHOWER_ID
  );
}

export function Step3Summary() {
  const { state } = useWizard();
  const { cart, lang } = state;

  const activeItems = cart.filter((l) => l.quantity > 0);
  const total = cartTotal(cart);
  const showShowerHint = hasDailyPass(cart) && !hasShowerOnly(cart);

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      {/* Line items */}
      <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
        {activeItems.map((line) => (
          <div
            key={line.productId}
            className="flex items-center justify-between px-4 py-3"
          >
            {/* Product name */}
            <span className="text-base text-gray-900">
              {lang === 'it' ? line.labelIt : line.labelEn}
            </span>

            {/* Quantity + line total */}
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-gray-500">
                x{line.quantity}
              </span>
              <span className="text-base font-semibold tabular-nums text-gray-900">
                {formatChf(line.priceCents * line.quantity)}
              </span>
            </div>
          </div>
        ))}

        {/* Grand total */}
        <div className="flex items-center justify-between px-4 py-4 bg-gray-50 rounded-b-2xl">
          <span className="text-lg font-bold text-gray-900">
            Totale / Total
          </span>
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {formatChf(total)}
          </span>
        </div>
      </div>

      {/* Shower included hint */}
      {showShowerHint && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <p className="text-sm text-blue-800">
            La doccia è inclusa con la giornaliera
            <br />
            <span className="text-blue-600">
              Shower is included with your daily pass
            </span>
          </p>
        </div>
      )}

      {/* Payment notice */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
        <p className="text-sm text-gray-600">
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
