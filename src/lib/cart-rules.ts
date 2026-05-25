// src/lib/cart-rules.ts
import type { CartLine } from './cart';

const DAILY_PASS_IDS = ['adult', 'student', 'teen', 'child', 'family'];
const DAILY_GROUP_ID = 'daily';
const SHOWER_ID = 'shower';

/**
 * Returns true if the cart contains any daily pass product.
 * Used to show "already included" notes for add-ons like showers.
 */
export function hasDailyPass(cart: CartLine[]): boolean {
  return cart.some(
    (l) =>
      l.quantity > 0 &&
      (DAILY_PASS_IDS.includes(l.productId) || l.groupId === DAILY_GROUP_ID)
  );
}

/**
 * Returns true if the cart contains only the standalone shower product.
 * Used to differentiate "shower only" from "shower included with daily pass".
 */
export function hasShowerOnly(cart: CartLine[]): boolean {
  return cart.some((l) => l.quantity > 0 && l.productId === SHOWER_ID);
}
