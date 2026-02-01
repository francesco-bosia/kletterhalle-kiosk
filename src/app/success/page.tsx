'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTicketById, formatTicketPrice } from '@/lib/tickets';

function SuccessPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticket');
  const paymentIntent = searchParams.get('paymentIntent');
  const sessionId = searchParams.get('session');

  const [countdown, setCountdown] = useState(15);

  const ticket = ticketId ? getTicketById(ticketId) : null;

  // Countdown timer for auto-redirect
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      router.push('/');
    }
  }, [countdown, router]);

  const handleReturnHome = () => {
    router.push('/');
  };

  const handlePrintReceipt = () => {
    // For now, use browser print
    // In production, this would call the thermal printer API
    window.print();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-8">
      {/* Success icon */}
      <div className="mb-8">
        <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center">
          <svg
            className="w-12 h-12 text-white"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </div>

      {/* Success message */}
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Zahlung erfolgreich!
        </h1>
        <p className="text-2xl text-gray-600">
          Vielen Dank für Ihren Einkauf
        </p>
      </header>

      {/* Receipt/ticket preview */}
      {ticket && (
        <main className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8 border-2 border-dashed border-gray-300">
            <div className="text-center mb-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">
                Kletterhalle Ticket
              </h2>
              <p className="text-sm text-gray-500">
                {new Date().toLocaleDateString('de-CH', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>

            <div className="border-t border-b border-gray-200 py-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">Ticket:</span>
                <span className="font-semibold text-gray-900">{ticket.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Betrag:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {formatTicketPrice(ticket.price)}
                </span>
              </div>
            </div>

            {paymentIntent && (
              <div className="text-xs text-gray-400 text-center">
                Transaktion: {paymentIntent.slice(0, 12)}...
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-4">
            <button
              onClick={handlePrintReceipt}
              className="w-full py-4 px-8 bg-blue-600 text-white text-xl font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
            >
              Beleg drucken
            </button>

            <button
              onClick={handleReturnHome}
              className="w-full py-3 px-8 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Zurück zur Startseite ({countdown}s)
            </button>
          </div>
        </main>
      )}
    </div>
  );
}

/**
 * Success confirmation page.
 * Shows payment confirmation and receipt preview.
 */
export default function SuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Wird geladen...</div>
      </div>
    }>
      <SuccessPageContent />
    </Suspense>
  );
}
