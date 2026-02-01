'use client';

import { useCart } from '@/contexts/cart-context';
import { formatTicketPrice } from '@/lib/tickets';
import { Trash2 } from 'lucide-react';

export function CartSummary() {
  const { items, total, itemCount, removeItem, updateQuantity } = useCart();

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">Ihr Warenkorb ist leer</p>
        <a href="/" className="mt-4 inline-block text-blue-600 hover:underline">
          Zurück zur Ticketauswahl
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.ticket.id}
          className="bg-white rounded-xl shadow p-4 flex items-center gap-4"
        >
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">
              {item.ticket.name}
            </h3>
            <p className="text-gray-600">{item.ticket.description}</p>
            <p className="text-blue-600 font-semibold mt-1">
              {formatTicketPrice(item.ticket.price)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-600">x{item.quantity}</span>
            <span className="font-semibold text-gray-900 w-24 text-right">
              {formatTicketPrice(item.ticket.price * item.quantity)}
            </span>
            <button
              onClick={() => removeItem(item.ticket.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Remove item"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}

      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-gray-600">
              Gesamt ({itemCount} {itemCount === 1 ? 'Ticket' : 'Tickets'})
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {formatTicketPrice(total)}
            </p>
          </div>
          <a
            href="/payment"
            className="px-8 py-4 bg-blue-600 text-white text-xl font-semibold rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors"
          >
            Zur Kasse
          </a>
        </div>
      </div>

      <a
        href="/"
        className="block text-center text-gray-600 hover:text-gray-800 transition-colors"
      >
        ← Zurück zur Ticketauswahl
      </a>
    </div>
  );
}
