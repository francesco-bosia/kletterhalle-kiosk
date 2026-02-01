'use client';

import { useState } from 'react';

export type PaymentMethod = 'card' | 'twint';

interface PaymentMethodSelectorProps {
  onSelect: (method: PaymentMethod) => void;
  selected?: PaymentMethod;
  disabled?: boolean;
}

/**
 * Payment method selector for choosing between Card and TWINT.
 * Large touch-friendly buttons optimized for kiosk use.
 */
export function PaymentMethodSelector({
  onSelect,
  selected,
  disabled = false,
}: PaymentMethodSelectorProps) {
  const [internalSelected, setInternalSelected] = useState<PaymentMethod | undefined>(selected);

  const handleSelect = (method: PaymentMethod) => {
    if (disabled) return;
    setInternalSelected(method);
    onSelect(method);
  };

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
        Zahlungsart wählen
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card payment option */}
        <button
          onClick={() => handleSelect('card')}
          disabled={disabled}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-200
            ${disabled
              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
              : internalSelected === 'card'
                ? 'bg-blue-50 border-blue-500 shadow-lg'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md active:scale-95 cursor-pointer'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Card icon */}
            <div className="w-20 h-20 flex items-center justify-center">
              <svg
                className="w-full h-full text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              Karte / NFC
            </h3>
            <p className="text-sm text-gray-600 text-center">
              Kartenzahlung, Apple Pay oder Google Pay
            </p>
          </div>
        </button>

        {/* TWINT payment option */}
        <button
          onClick={() => handleSelect('twint')}
          disabled={disabled}
          className={`
            relative p-8 rounded-2xl border-2 transition-all duration-200
            ${disabled
              ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
              : internalSelected === 'twint'
                ? 'bg-blue-50 border-blue-500 shadow-lg'
                : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-md active:scale-95 cursor-pointer'
            }
          `}
        >
          <div className="flex flex-col items-center gap-4">
            {/* TWINT icon (placeholder hexagon shape) */}
            <div className="w-20 h-20 flex items-center justify-center">
              <svg
                className="w-full h-full text-gray-700"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm0 2.18L19.5 8 12 11.82 4.5 8 12 4.18zM4 9.64l7 3.64v6.54l-7-3.64V9.64zm9 10.18v-6.54l7-3.64v6.54l-7 3.64z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900">
              TWINT
            </h3>
            <p className="text-sm text-gray-600 text-center">
              QR-Code scannen mit TWINT App
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
