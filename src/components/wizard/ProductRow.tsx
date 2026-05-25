'use client';

import type { Product } from '@/lib/catalog';
import type { Lang } from '@/lib/i18n';
import { formatChf } from '@/lib/money';
import { QuantityControl } from '@/components/wizard/QuantityControl';

interface ProductRowProps {
  product: Product;
  quantity: number;
  onInc: () => void;
  onDec: () => void;
  lang: Lang;
}

export function ProductRow({ product, quantity, onInc, onDec }: ProductRowProps) {
  const isFree = product.isFree === true;

  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-3 last:border-b-0">
      {/* Labels */}
      <div className="flex flex-col">
        <span className="text-base font-medium text-gray-900">
          {product.label.it}
        </span>
        <span className="text-sm text-gray-500">
          {product.label.en}
        </span>
      </div>

      {/* Price + quantity */}
      <div className="flex items-center gap-4">
        {isFree ? (
          <span className="text-sm text-gray-500 italic">
            Gratis / Free of charge
          </span>
        ) : (
          <>
            <span className="text-base font-semibold tabular-nums text-gray-900">
              {formatChf(product.priceCents)}
            </span>
            <QuantityControl quantity={quantity} onInc={onInc} onDec={onDec} />
          </>
        )}
      </div>
    </div>
  );
}
