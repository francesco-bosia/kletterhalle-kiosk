'use client';

import { useCart } from '@/contexts/cart-context';
import { QuantitySelector } from '@/components/quantity-selector';
import { useState } from 'react';
import { TICKETS, formatTicketPrice, getTicketById } from '@/lib/tickets';
import Link from 'next/link';

export default function HomePage() {
  const { addItem, items, updateQuantity, total, itemCount } = useCart();
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  // Get current quantity for a ticket
  const getQuantity = (ticketId: string) => {
    const cartItem = items.find(i => i.ticket.id === ticketId);
    return cartItem ? cartItem.quantity : (quantities[ticketId] || 0);
  };

  const handleIncrease = (ticketId: string) => {
    const ticket = getTicketById(ticketId);
    if (!ticket) return;

    const currentQuantity = getQuantity(ticketId);
    console.log('[HomePage] handleIncrease:', { ticketId, currentQuantity, ticket });
    if (currentQuantity === 0) {
      console.log('[HomePage] Calling addItem');
      addItem(ticket);
    } else {
      console.log('[HomePage] Calling updateQuantity');
      updateQuantity(ticketId, currentQuantity + 1);
    }
    setQuantities(prev => ({ ...prev, [ticketId]: (prev[ticketId] || 0) + 1 }));
  };

  const handleDecrease = (ticketId: string) => {
    const currentQuantity = getQuantity(ticketId);
    if (currentQuantity <= 1) {
      // Remove from cart if quantity would go to 0
      updateQuantity(ticketId, 0);
      setQuantities(prev => ({ ...prev, [ticketId]: 0 }));
    } else {
      updateQuantity(ticketId, currentQuantity - 1);
      setQuantities(prev => ({ ...prev, [ticketId]: currentQuantity - 1 }));
    }
  };

  const hasItemsInCart = itemCount > 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-8">
      <header className="mb-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Kletterhalle</h1>
        <p className="text-xl text-gray-600">Wählen Sie Ihre Tickets</p>
      </header>

      <main className="max-w-4xl mx-auto">
        <div className="grid gap-6 md:grid-cols-3">
          {TICKETS.map((ticket) => {
            const quantity = getQuantity(ticket.id);
            return (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl shadow-lg p-6 flex flex-col"
              >
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {ticket.name}
                  </h2>
                  <p className="text-gray-600 mb-4">{ticket.description}</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatTicketPrice(ticket.price)}
                  </p>
                </div>

                <div className="mt-6 flex items-center justify-center">
                  <QuantitySelector
                    quantity={quantity}
                    onIncrease={() => handleIncrease(ticket.id)}
                    onDecrease={() => handleDecrease(ticket.id)}
                    min={0}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {hasItemsInCart && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-600">Gesamt ({itemCount} {itemCount === 1 ? 'Ticket' : 'Tickets'})</p>
                <p className="text-3xl font-bold text-blue-600">
                  {formatTicketPrice(total)}
                </p>
              </div>
              <Link
                href="/cart"
                className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                Zur Kasse
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
