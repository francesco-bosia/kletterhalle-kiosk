'use client';

import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { StepTitle } from '@/components/wizard/StepTitle';
import { ProductGroupHeader } from '@/components/wizard/ProductGroupHeader';
import { ProductRow } from '@/components/wizard/ProductRow';

export function Step1Tickets() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(1);

  return (
    <div>
      <StepTitle
        it="Scegli i biglietti"
        en="Choose your tickets"
        descriptionIt="Puoi acquistare più biglietti contemporaneamente."
        descriptionEn="You can purchase several tickets at once."
      />

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
