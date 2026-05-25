'use client';

interface QuantityControlProps {
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function QuantityControl({ quantity, onInc, onDec }: QuantityControlProps) {
  return (
    <div className="flex items-center">
      <button
        onClick={onDec}
        disabled={quantity === 0}
        className={`flex h-10 w-10 items-center justify-center rounded-lg border text-lg font-medium transition-colors ${
          quantity === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : 'border-gray-300 text-black active:bg-gray-100'
        }`}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums text-black">
        {quantity}
      </span>
      <button
        onClick={onInc}
        className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 text-lg font-medium text-black transition-colors active:bg-gray-100"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
