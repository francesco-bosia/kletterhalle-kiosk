import Stripe from 'stripe';

/**
 * Initialize Stripe client with secret key from environment.
 * Throws error if key is not configured.
 */
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY environment variable is not set');
  }

  // Cast config to avoid type-version conflict from @stripe/terminal-js nested stripe@8
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new Stripe(secretKey, {
    apiVersion: '2026-05-27.dahlia',
    typescript: true,
  } as any);
}

/**
 * Singleton Stripe client instance
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = getStripeClient();
  }
  return stripeInstance;
}

/**
 * Calculate amount in cents from CHF value.
 * e.g., 25.00 CHF -> 2500 cents
 */
export function toAmount(chf: number): number {
  return Math.round(chf * 100);
}

/**
 * Format amount in cents to CHF string.
 * e.g., 2500 -> "CHF 25.00"
 */
export function formatChf(amount: number): string {
  return `CHF ${(amount / 100).toFixed(2)}`;
}
