'use client';

import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { ProductGroupHeader } from '@/components/wizard/ProductGroupHeader';
import { ProductRow } from '@/components/wizard/ProductRow';

export function Step1Tickets() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(1);

  return (
    <div className="px-4 py-2">
      {groups.map((group) => (
        <div key={group.id}>
          <ProductGroupHeader group={group} lang={state.lang} />
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
                  lang={state.lang}
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
                lang={state.lang}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
