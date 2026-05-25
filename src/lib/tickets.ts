import { CATALOG, getProductById } from './catalog';

export interface Ticket {
  id: string;
  name: string;
  price: number;
  description: string;
}

// Convert catalog products to legacy ticket format for webhook compatibility
export const TICKETS: Ticket[] = CATALOG.groups.flatMap(g =>
  g.products
    .filter(p => !p.isFree)
    .map(p => ({
      id: p.id,
      name: p.label.it,
      price: p.priceCents,
      description: p.sublabel?.it || p.label.en,
    }))
);

export function getTicketById(id: string): Ticket | undefined {
  const product = getProductById(id);
  if (!product) return undefined;
  return {
    id: product.id,
    name: product.label.it,
    price: product.priceCents || 0,
    description: product.sublabel?.it || product.label.en,
  };
}

export function formatTicketPrice(price: number): string {
  return `CHF ${(price / 100).toFixed(2)}`;
}
