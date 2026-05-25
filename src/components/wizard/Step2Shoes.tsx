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
    // Clear shoes from cart if present, then advance
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
    <div className="flex flex-col items-center gap-6 px-4 py-6">
      {/* Single product card */}
      <div className="w-full max-w-md rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4">
          {/* Labels */}
          <div className="flex flex-col items-center text-center">
            <span className="text-xl font-bold text-gray-900">
              {product.label.it}
            </span>
            <span className="mt-0.5 text-base text-gray-500">
              {product.label.en}
            </span>
          </div>

          {/* Price */}
          <span className="text-2xl font-bold tabular-nums text-gray-900">
            {formatChf(product.priceCents)}
          </span>

          {/* Quantity control */}
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
        className="text-base text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600 hover:decoration-gray-500"
      >
        No grazie, salta questo passo
        <br />
        <span className="text-sm">No thanks, skip this step</span>
      </button>
    </div>
  );
}
