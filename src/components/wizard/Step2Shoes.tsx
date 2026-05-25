'use client';

import { useCallback } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { StepTitle } from '@/components/wizard/StepTitle';
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
    <div>
      <StepTitle
        it="Vuoi noleggiare le scarpette?"
        en="Need climbing shoes?"
        descriptionIt="Aggiungi il numero di paia necessarie."
        descriptionEn="Add the number of pairs you need."
      />

      {/* Single product card */}
      <div className="w-full max-w-sm mx-auto bg-gray-100 rounded-3xl p-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="text-sm font-extrabold tracking-[0.2em] text-black">
            NOLEGGIO
          </h3>
          <span className="text-sm italic text-gray-400">
            Rental
          </span>
        </div>

        {/* Product name */}
        <div className="text-center mb-4">
          <h2 className="text-4xl font-black text-black">
            {product.label.it}
          </h2>
          <p className="text-lg italic text-gray-400 mt-1">
            {product.label.en}
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <p className="text-3xl font-black text-black">
            {formatChf(product.priceCents)}
          </p>
          <p className="text-sm text-gray-500">
            per paio / per pair
          </p>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-6" />

        {/* Quantity selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-black">
              Quanti?
            </p>
            <p className="text-sm italic text-gray-400">
              How many?
            </p>
          </div>
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
        className="mt-6 w-full text-center text-sm text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600"
      >
        No grazie, salta questo passo
        <br />
        <span className="text-xs">No thanks, skip this step</span>
      </button>
    </div>
  );
}
