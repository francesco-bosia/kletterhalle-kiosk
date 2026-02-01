'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentMethodSelector, PaymentMethod } from '@/components/payment-method-selector';
import { TerminalProvider, useTerminal } from '@/components/terminal-provider';
import { getTicketById, formatTicketPrice } from '@/lib/tickets';

function PaymentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticket');

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

  const { terminal, isSimulator, isConnected, error: terminalError } = useTerminal();

  const ticket = ticketId ? getTicketById(ticketId) : null;

  // Redirect to home if no ticket selected
  useEffect(() => {
    if (!ticket) {
      router.push('/');
    }
  }, [ticket, router]);

  if (!ticket) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
        <div className="text-2xl text-gray-600">Wird geladen...</div>
      </div>
    );
  }

  const handlePaymentStart = async () => {
    if (!selectedMethod) {
      setError('Bitte wählen Sie eine Zahlungsart');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setPaymentStatus(null);

    try {
      // Create PaymentIntent via API
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: ticket.id,
          amount: ticket.price,
          paymentMethod: selectedMethod,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      if (selectedMethod === 'card') {
        // Use Stripe Terminal SDK for card payments
        if (!terminal) {
          throw new Error('Terminal not initialized. Please refresh the page.');
        }

        if (!isConnected) {
          throw new Error('Reader not connected. Please wait for the simulator to connect.');
        }

        setPaymentStatus('Bitte Karte berühren...');

        // Step 1: Collect payment method from reader
        const collectResult = await terminal.collectPaymentMethod(data.clientSecret);

        if ('error' in collectResult) {
          throw new Error(collectResult.error.message || 'Failed to collect payment method');
        }

        setPaymentStatus('Zahlung wird verarbeitet...');

        // Step 2: Process the payment with the collected PaymentIntent
        const processResult = await terminal.processPayment(collectResult.paymentIntent);

        if ('error' in processResult) {
          throw new Error(processResult.error.message || 'Payment failed');
        }

        const paymentIntent = processResult.paymentIntent;

        // Check payment result
        if (paymentIntent.status === 'succeeded') {
          router.push(`/success?ticket=${ticket.id}&paymentIntent=${data.paymentIntentId}`);
        } else if (paymentIntent.status === 'canceled') {
          throw new Error('Zahlung abgebrochen');
        } else {
          throw new Error(`Zahlung fehlgeschlagen: ${paymentIntent.status}`);
        }
      } else {
        // For TWINT - redirect to Stripe Checkout
        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
        } else {
          throw new Error('No checkout URL returned');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ein Fehler ist aufgetreten');
      setPaymentStatus(null);
      setIsProcessing(false);
    }
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-8">
      {/* Header with ticket info */}
      <header className="mb-6 text-center">
        <div className="mb-4">
          <button
            onClick={handleBack}
            className="text-gray-500 hover:text-gray-700 transition-colors"
            disabled={isProcessing}
          >
            ← Zurück
          </button>
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          {ticket.name}
        </h1>
        <p className="text-3xl font-semibold text-blue-600">
          {formatTicketPrice(ticket.price)}
        </p>
      </header>

      {/* Terminal status indicator */}
      {selectedMethod === 'card' && (
        <div className="mb-4 px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2">
          {isConnected ? (
            <>
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-700">
                {isSimulator ? 'Simulator verbunden' : 'Kartenterminal verbunden'}
              </span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></span>
              <span className="text-yellow-700">
                Verbinde mit {isSimulator ? 'Simulator' : 'Kartenterminal'}...
              </span>
            </>
          )}
        </div>
      )}

      {/* Payment method selection */}
      <main className="w-full flex flex-col items-center gap-8">
        {!selectedMethod ? (
          <PaymentMethodSelector
            onSelect={setSelectedMethod}
            disabled={isProcessing}
          />
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {selectedMethod === 'card' ? 'Kartenzahlung' : 'TWINT'}
              </h2>
              <p className="text-gray-600 mb-8">
                {selectedMethod === 'card'
                  ? 'Bitte berühren Sie den Kartenterminal mit Ihrer Karte, Apple Pay oder Google Pay.'
                  : 'Scannen Sie den QR-Code mit Ihrer TWINT App.'
                }
              </p>

              {terminalError && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700">
                  Terminal: {terminalError}
                </div>
              )}

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                  {error}
                </div>
              )}

              {paymentStatus && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700">
                  {paymentStatus}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <button
                  onClick={handlePaymentStart}
                  disabled={isProcessing || (selectedMethod === 'card' && !isConnected)}
                  className="w-full py-4 px-8 bg-blue-600 text-white text-xl font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isProcessing ? 'Wird verarbeitet...' : 'Zahlung starten'}
                </button>

                <button
                  onClick={() => setSelectedMethod(null)}
                  disabled={isProcessing}
                  className="w-full py-3 px-8 text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Payment processing page wrapped in TerminalProvider.
 */
export default function PaymentPage() {
  return (
    <TerminalProvider>
      <Suspense fallback={
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex items-center justify-center">
          <div className="text-2xl text-gray-600">Wird geladen...</div>
        </div>
      }>
        <PaymentPageContent />
      </Suspense>
    </TerminalProvider>
  );
}
