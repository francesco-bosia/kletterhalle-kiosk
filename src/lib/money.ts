/**
 * Client-safe money formatting helpers.
 * All prices in the system are stored as integer cents (CHF).
 */

/**
 * Format cents as a CHF string.
 * @example formatChf(1600) // => "CHF 16.00"
 * @example formatChf(0)    // => "CHF 0.00"
 */
export function formatChf(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

/**
 * Convert cents to a decimal amount.
 * @example toAmount(1600) // => 16
 */
export function toAmount(cents: number): number {
  return cents / 100;
}
