'use client';

import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onIncrease: () => void;
  onDecrease: () => void;
  min?: number;
  max?: number;
}

export function QuantitySelector({
  quantity,
  onIncrease,
  onDecrease,
  min = 0,
  max = 99,
}: QuantitySelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onDecrease}
        disabled={quantity <= min}
        className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-300 active:bg-gray-400 transition-colors"
        aria-label="Decrease quantity"
      >
        <Minus className="w-5 h-5 text-gray-700" strokeWidth={2.5} />
      </button>

      <span className="text-xl font-semibold text-gray-900 w-8 text-center">
        {quantity}
      </span>

      <button
        onClick={onIncrease}
        disabled={quantity >= max}
        className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 active:bg-blue-800 transition-colors"
        aria-label="Increase quantity"
      >
        <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
      </button>
    </div>
  );
}
