'use client';

import { CartSummary } from '@/components/cart-summary';
import { CartProvider } from '@/contexts/cart-context';

function CartPageContent() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Warenkorb</h1>
        <p className="text-xl text-gray-600">Überprüfen Sie Ihre Auswahl</p>
      </header>

      <main className="max-w-2xl mx-auto">
        <CartSummary />
      </main>
    </div>
  );
}

export default function CartPage() {
  return (
    <CartProvider>
      <CartPageContent />
    </CartProvider>
  );
}
