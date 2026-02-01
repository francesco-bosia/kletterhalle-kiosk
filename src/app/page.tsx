'use client';

import { useRouter } from 'next/navigation';
import { TicketCard } from '@/components/ticket-card';
import { TICKETS } from '@/lib/tickets';

/**
 * Ticket selection page - the main entry point for the kiosk.
 * Displays available tickets with large touch-friendly buttons.
 */
export default function HomePage() {
  const router = useRouter();

  const handleTicketSelect = (ticketId: string) => {
    // Navigate to payment page with selected ticket
    router.push(`/payment?ticket=${ticketId}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center p-8">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          Kletterhalle
        </h1>
        <p className="text-2xl text-gray-600">
          Bitte wählen Sie Ihr Ticket
        </p>
      </header>

      {/* Ticket options */}
      <main className="w-full max-w-2xl flex flex-col items-center gap-6">
        {TICKETS.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onSelect={() => handleTicketSelect(ticket.id)}
          />
        ))}
      </main>

      {/* Footer */}
      <footer className="mt-16 text-center text-gray-500">
        <p className="text-sm">
          Selbstbedienungsticket-Kiosk
        </p>
      </footer>
    </div>
  );
}
