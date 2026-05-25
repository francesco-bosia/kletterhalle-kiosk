'use client';

import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { t } from '@/lib/i18n';
import { ProductGroupHeader } from '@/components/wizard/ProductGroupHeader';
import { ProductRow } from '@/components/wizard/ProductRow';

export function Step1Tickets() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(1);

  const title = t(`stepTitles.1.${state.lang}`, state.lang);
  const subtitle = t(`stepSubtitles.1.${state.lang}`, state.lang);

  return (
    <div className="px-5 py-2">
      {/* Title section */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-black">
          {state.lang === 'it' ? 'Scegli i biglietti' : 'Choose your tickets'}
        </h1>
        <p className="mt-1 text-sm text-gray-400 italic">
          {state.lang === 'en' ? 'Scegli i biglietti' : 'Choose your tickets'}
        </p>
        <p className="mt-3 text-sm text-gray-400 text-center">
          Puoi acquistare più biglietti contemporaneamente.
          <br />
          You can purchase several tickets at once.
        </p>
      </div>

      {groups.map((group) => (
        <div key={group.id}>
          <ProductGroupHeader group={group} />
          {group.products.map((product) => {
            const quantity =
              state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

            if (product.isFree) {
              return (
                <ProductRow
                  key={product.id}
                  product={product}
                  quantity={0}
                  onInc={() => {}}
                  onDec={() => {}}
                />
              );
            }

            return (
              <ProductRow
                key={product.id}
                product={product}
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
            );
          })}
        </div>
      ))}
    </div>
  );
}
