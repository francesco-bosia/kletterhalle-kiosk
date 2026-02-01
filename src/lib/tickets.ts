/**
 * Ticket configuration for the bouldering hall kiosk.
 * Prices are stored in cents (CHF).
 */

export interface Ticket {
  id: string;
  name: string;
  price: number; // Amount in cents (e.g., 2500 = CHF 25.00)
  description: string;
}

export const TICKETS: Ticket[] = [
  {
    id: 'adult-day',
    name: 'Tageskarte Erwachsene',
    price: 2500, // CHF 25.00
    description: 'Ganzjähriger Zugang, 1 Tag gültig',
  },
  {
    id: 'child-day',
    name: 'Tageskarte Kind',
    price: 1500, // CHF 15.00
    description: 'Bis 16 Jahre, 1 Tag gültig',
  },
  {
    id: 'student-day',
    name: 'Tageskarte Student',
    price: 2000, // CHF 20.00
    description: 'Mit gültigem Ausweis, 1 Tag gültig',
  },
];

/**
 * Find a ticket by ID.
 * Returns undefined if ticket not found.
 */
export function getTicketById(id: string): Ticket | undefined {
  return TICKETS.find((ticket) => ticket.id === id);
}

/**
 * Format price in CHF for display.
 * e.g., 2500 -> "CHF 25.00"
 */
export function formatTicketPrice(price: number): string {
  return `CHF ${(price / 100).toFixed(2)}`;
}
