'use client';

import { useCallback } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { QuantityControl } from '@/components/wizard/QuantityControl';

export function Step2Shoes() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(2);
  const rentalGroup = groups.find((g) => g.layout === 'single-card');
  const product = rentalGroup?.products[0];

  const handleSkip = useCallback(() => {
    if (!product) return;
    const existing = state.cart.find((l) => l.productId === product.id);
    if (existing) {
      dispatch({ type: 'SET', productId: product.id, quantity: 0 });
    }
    dispatch({ type: 'GO_TO_STEP', step: 3 });
  }, [product, state.cart, dispatch]);

  if (!product) return null;

  const quantity =
    state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

  return (
    <div className="flex flex-col items-center gap-6 px-5 py-2">
      {/* Title section */}
      <div className="mb-2 text-center">
        <h1 className="text-2xl font-bold text-black">
          {state.lang === 'it' ? 'Vuoi noleggiare le scarpette?' : 'Need climbing shoes?'}
        </h1>
        <p className="mt-1 text-sm text-gray-400 italic">
          {state.lang === 'en' ? 'Vuoi noleggiare le scarpette?' : 'Need climbing shoes?'}
        </p>
        <p className="mt-3 text-sm text-gray-400">
          Aggiungi il numero di paia necessarie.
          <br />
          Add the number of pairs you need.
        </p>
      </div>

      {/* Single product card */}
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-col items-center text-center">
            <span className="text-xl font-bold text-black">
              {product.label.it}
            </span>
            <span className="mt-0.5 text-sm text-gray-400">
              {product.label.en}
            </span>
          </div>

          <span className="text-2xl font-bold tabular-nums text-black">
            {formatChf(product.priceCents)}
          </span>

          <QuantityControl
            quantity={quantity}
            onInc={() =>
              dispatch({
                type: 'INC',
                productId: product.id,
                groupId: rentalGroup!.id,
                labelIt: product.label.it,
                labelEn: product.label.en,
                priceCents: product.priceCents,
              })
            }
            onDec={() =>
              dispatch({
                type: 'DEC',
                productId: product.id,
              })
            }
          />
        </div>
      </div>

      {/* Skip link */}
      <button
        type="button"
        onClick={handleSkip}
        className="text-sm text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600"
      >
        No grazie, salta questo passo
        <br />
        <span className="text-xs">No thanks, skip this step</span>
      </button>
    </div>
  );
}
