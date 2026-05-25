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
    <div className="flex items-center justify-between py-4 border-b border-gray-100">
      {/* Labels */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-lg font-bold text-black">
          {product.label.it}
        </span>
        <span className="text-sm italic text-gray-400">
          {product.label.en}
        </span>
      </div>

      {/* Price + quantity */}
      {isFree ? (
        <span className="text-sm text-gray-400 italic">
          Gratis / Free of charge
        </span>
      ) : (
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-lg font-bold tabular-nums text-black">
            {formatChf(product.priceCents)}
          </span>
          <QuantityControl quantity={quantity} onInc={onInc} onDec={onDec} />
        </div>
      )}
    </div>
  );
}
