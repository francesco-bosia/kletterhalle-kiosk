'use client';

interface QuantityControlProps {
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function QuantityControl({ quantity, onInc, onDec }: QuantityControlProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={onDec}
        disabled={quantity === 0}
        className={`flex h-12 w-12 items-center justify-center rounded-lg border-2 text-xl font-bold transition-colors ${
          quantity === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : 'border-gray-400 text-gray-700 active:bg-gray-100'
        }`}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <span className="w-8 text-center text-lg font-semibold tabular-nums">
        {quantity}
      </span>
      <button
        onClick={onInc}
        className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-gray-400 text-xl font-bold text-gray-700 transition-colors active:bg-gray-100"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
