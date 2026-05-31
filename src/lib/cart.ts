import type { Lang } from './i18n';
import { getProductById } from './catalog';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CartLine {
  productId: string;
  groupId: string;
  labelIt: string;
  labelEn: string;
  priceCents: number;
  quantity: number;
}

// ── Action types ───────────────────────────────────────────────────────────────

export type CartAction =
  | { type: 'INC'; productId: string; groupId: string; labelIt: string; labelEn: string; priceCents: number }
  | { type: 'DEC'; productId: string }
  | { type: 'SET'; productId: string; quantity: number }
  | { type: 'CLEAR' };

// ── Reducer ────────────────────────────────────────────────────────────────────

export function cartReducer(state: CartLine[], action: CartAction): CartLine[] {
  switch (action.type) {
    case 'INC': {
      const existing = state.find((l) => l.productId === action.productId);
      if (existing) {
        return state.map((l) =>
          l.productId === action.productId ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...state,
        {
          productId: action.productId,
          groupId: action.groupId,
          labelIt: action.labelIt,
          labelEn: action.labelEn,
          priceCents: action.priceCents,
          quantity: 1,
        },
      ];
    }
    case 'DEC': {
      const line = state.find((l) => l.productId === action.productId);
      if (!line) return state;
      if (line.quantity <= 1) {
        return state.filter((l) => l.productId !== action.productId);
      }
      return state.map((l) =>
        l.productId === action.productId ? { ...l, quantity: l.quantity - 1 } : l
      );
    }
    case 'SET': {
      if (action.quantity <= 0) {
        return state.filter((l) => l.productId !== action.productId);
      }
      const existing = state.find((l) => l.productId === action.productId);
      if (!existing) return state;
      return state.map((l) =>
        l.productId === action.productId ? { ...l, quantity: action.quantity } : l
      );
    }
    case 'CLEAR':
      return [];
    default:
      return state;
  }
}

// ── Selectors ──────────────────────────────────────────────────────────────────

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.priceCents * l.quantity, 0);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.quantity, 0);
}

// ── API payload mappers ────────────────────────────────────────────────────────

export interface CompactCartItem {
  id: string;
  qty: number;
}

export interface PaymentsCreatePayload {
  items: CompactCartItem[];
  total: number;
  paymentMethod: 'card' | 'twint';
  lang: Lang;
}

export function toPaymentsCreatePayload(
  cart: CartLine[],
  lang: Lang,
  paymentMethod: 'card' | 'twint'
): PaymentsCreatePayload {
  return {
    items: cart.map((l) => ({ id: l.productId, qty: l.quantity })),
    total: cartTotal(cart),
    paymentMethod,
    lang,
  };
}

// ── Cart expansion helpers ───────────────────────────────────────────────────────────

export interface ExpandedCartItem {
  ticketId: string;
  ticketName: string;
  price: number;
  quantity: number;
}

/**
 * Expands compact {id, qty}[] items by looking up products from the catalog.
 * Used server-side to reconstruct full item details from Stripe metadata.
 */
export function expandCompactItems(
  items: CompactCartItem[]
): ExpandedCartItem[] {
  return items.map((it) => {
    const p = getProductById(it.id);
    if (!p) throw new Error(`Unknown product id: ${it.id}`);
    return {
      ticketId: it.id,
      ticketName: p.label.it, // Italian names for TWINT line items
      price: p.isFree ? 0 : p.priceCents,
      quantity: it.qty,
    };
  });
}

export interface PrintPayload {
  items: Array<{ name: string; quantity: number; price: number }>;
  total: number;
  transactionId: string;
  paymentMethod: string;
  lang: Lang;
}

export function toPrintPayload(
  cart: CartLine[],
  opts: { transactionId: string; paymentMethod: string; lang: Lang }
): PrintPayload {
  return {
    items: cart.map((l) => ({
      name: opts.lang === 'it' ? l.labelIt : l.labelEn,
      quantity: l.quantity,
      price: l.priceCents,
    })),
    total: cartTotal(cart),
    transactionId: opts.transactionId,
    paymentMethod: opts.paymentMethod,
    lang: opts.lang,
  };
}
