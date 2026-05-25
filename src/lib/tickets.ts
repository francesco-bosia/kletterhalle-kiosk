/**
 * Temporary shim — preserves the public API consumed by the Stripe webhook.
 * Will be replaced in Phase 2 with the proper Splüia ticket catalogue.
 */

export interface Ticket {
  id: string;
  name: string;
  price: number; // cents (CHF)
  description: string;
}

export const TICKETS: Ticket[] = [
  {
    id: 'adult-day',
    name: 'Tageskarte Erwachsene',
    price: 2500,
    description: 'Ganzjähriger Zugang, 1 Tag gültig',
  },
  {
    id: 'child-day',
    name: 'Tageskarte Kind',
    price: 1500,
    description: 'Bis 16 Jahre, 1 Tag gültig',
  },
  {
    id: 'student-day',
    name: 'Tageskarte Student',
    price: 2000,
    description: 'Mit gültigem Ausweis, 1 Tag gültig',
  },
];

export function getTicketById(id: string): Ticket | undefined {
  return TICKETS.find((ticket) => ticket.id === id);
}

export function formatTicketPrice(price: number): string {
  return `CHF ${(price / 100).toFixed(2)}`;
}
