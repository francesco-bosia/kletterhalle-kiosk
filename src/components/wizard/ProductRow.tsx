'use client';

import type { Product } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { QuantityControl } from '@/components/wizard/QuantityControl';

interface ProductRowProps {
  product: Product;
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function ProductRow({ product, quantity, onInc, onDec }: ProductRowProps) {
  const isFree = product.isFree === true;

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-200">
      {/* Labels */}
      <div className="flex flex-col min-w-0 flex-1 pr-4">
        <span className="text-base font-bold text-black leading-tight">
          {product.label.it}
        </span>
        <span className="text-sm italic text-gray-400 leading-tight">
          {product.label.en}
        </span>
      </div>

      {/* Price + quantity */}
      {isFree ? (
        <div className="flex flex-col items-end text-right shrink-0">
          <span className="text-lg font-bold text-black leading-tight">
            Gratis
          </span>
          <span className="text-sm italic text-gray-400 leading-tight">
            Free of charge
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-base font-bold tabular-nums text-black">
            {formatChf(product.priceCents)}
          </span>
          <QuantityControl quantity={quantity} onInc={onInc} onDec={onDec} />
        </div>
      )}
    </div>
  );
}
