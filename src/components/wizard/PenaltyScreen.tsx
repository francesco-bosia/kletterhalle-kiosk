'use client';

import { useWizard } from '@/lib/wizard-context';
import { getHiddenGroup } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { StepTitle } from '@/components/wizard/StepTitle';
import { QuantityControl } from '@/components/wizard/QuantityControl';

export function PenaltyScreen() {
  const { state, dispatch } = useWizard();
  const group = getHiddenGroup('penalty');
  const product = group?.products[0];

  if (!group || !product) return null;

  const quantity =
    state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

  return (
    <div>
      <StepTitle
        it="Accesso senza titolo valido"
        en="Access without a valid pass"
      />

      {/* Single product card */}
      <div className="w-full max-w-sm mx-auto bg-gray-100 rounded-3xl p-5">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-extrabold tracking-[0.2em] text-black uppercase">
            {group.label.it}
          </h3>
          <span className="text-sm italic text-gray-400">
            {group.label.en}
          </span>
        </div>

        {/* Product name */}
        <div className="text-center mb-4">
          <h2 className="text-3xl font-black text-black">
            {product.label.it}
          </h2>
          <p className="text-lg italic text-gray-400 mt-1">
            {product.label.en}
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          <p className="text-2xl font-black text-black">
            {formatChf(product.priceCents)}
          </p>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-4" />

        {/* Quantity selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-black">Quanti?</p>
            <p className="text-sm italic text-gray-400">How many?</p>
          </div>
          <QuantityControl
            quantity={quantity}
            onInc={() =>
              dispatch({
                type: 'INC',
                productId: product.id,
                groupId: group.id,
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

      {/* Back link — exits penalty mode */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'EXIT_PENALTY' })}
        className="mt-4 w-full text-center text-sm text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600"
      >
        In dietro
        <br />
        <span className="text-xs">Back</span>
      </button>
    </div>
  );
}
