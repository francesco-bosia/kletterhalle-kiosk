/**
 * Client-safe money formatting helpers.
 * All prices in the system are stored as integer cents (CHF).
 */

/**
 * Format cents as a CHF string.
 * Drops trailing .00 from whole franc amounts.
 * @example formatChf(1600) // => "CHF 16"
 * @example formatChf(1650) // => "CHF 16.50"
 * @example formatChf(0)    // => "CHF 0"
 */
export function formatChf(cents: number): string {
  const whole = cents % 100 === 0;
  return whole ? `CHF ${cents / 100}` : `CHF ${(cents / 100).toFixed(2)}`;
}

/**
 * Convert cents to a decimal amount.
 * @example toAmount(1600) // => 16
 */
export function toAmount(cents: number): number {
  return cents / 100;
}
