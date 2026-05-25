'use client';

interface QuantityControlProps {
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function QuantityControl({ quantity, onInc, onDec }: QuantityControlProps) {
  const isIncPrimary = quantity > 0;

  return (
    <div className="flex items-center">
      <button
        onClick={onDec}
        disabled={quantity === 0}
        className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-colors ${
          quantity === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : 'border-gray-300 text-black active:bg-gray-100'
        }`}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums text-black">
        {quantity}
      </span>
      <button
        onClick={onInc}
        className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-colors ${
          isIncPrimary
            ? 'bg-black text-white border-black active:bg-gray-800'
            : 'border-gray-300 text-black active:bg-gray-100'
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
