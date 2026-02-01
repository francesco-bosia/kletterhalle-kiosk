import { Ticket } from '@/lib/tickets';
import { formatTicketPrice } from '@/lib/tickets';

interface TicketCardProps {
  ticket: Ticket;
  onSelect: () => void;
  disabled?: boolean;
}

/**
 * Ticket card component for the kiosk ticket selection page.
 * Features large touch-friendly buttons optimized for kiosk use.
 */
export function TicketCard({ ticket, onSelect, disabled = false }: TicketCardProps) {
  return (
    <button
      onClick={onSelect}
      disabled={disabled}
      className={`
        relative w-full max-w-md p-8 rounded-2xl text-left
        transition-all duration-200 ease-in-out
        ${disabled
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
          : 'bg-white text-gray-900 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 cursor-pointer border-2 border-transparent hover:border-blue-500'
        }
      `}
    >
      <div className="flex flex-col gap-4">
        {/* Ticket name */}
        <h2 className="text-3xl font-bold text-gray-900">
          {ticket.name}
        </h2>

        {/* Price */}
        <div className="text-5xl font-bold text-blue-600">
          {formatTicketPrice(ticket.price)}
        </div>

        {/* Description */}
        <p className="text-lg text-gray-600">
          {ticket.description}
        </p>

        {/* Selection indicator */}
        {!disabled && (
          <div className="flex items-center justify-end pt-2">
            <span className="text-sm font-medium text-blue-600 uppercase tracking-wide">
              Auswählen
            </span>
            <svg
              className="w-6 h-6 ml-2 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        )}
      </div>
    </button>
  );
}
