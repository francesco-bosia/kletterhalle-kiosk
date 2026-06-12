import { getProductById } from '@/lib/catalog';
import type { Lang } from '@/lib/i18n';
import type {
  CompactCartItem,
  PrintPayload,
  TransactionLogPayload,
} from '@/lib/cart';

export interface StripeFulfillmentMetadata {
  cartData?: string;
  lang?: string;
  paymentMethod?: string;
}

/**
 * Unrecoverable rebuild failure (bad metadata, product removed from the
 * catalog). The engine parks these as needs-attention instead of retrying.
 */
export class PermanentFulfillmentError extends Error {}

/**
 * Rebuild the print + log payloads server-side from the metadata we attach
 * to every PaymentIntent / Checkout Session at creation time. Client data is
 * never trusted. The TOTAL is the amount Stripe actually charged
 * (pi.amount / session.amount_total) — a catalog price edit inside the 24h
 * recovery window must not change the printed total. The catalog supplies
 * names and per-item prices; on a sum mismatch we log loudly and fulfill
 * with the Stripe amount.
 */
export function buildPayloadsFromMetadata(
  metadata: StripeFulfillmentMetadata,
  opts: {
    transactionId: string;
    stripeIds: { paymentIntent?: string; checkoutSession?: string };
    chargedAmount: number;
  }
): { print: PrintPayload; log: TransactionLogPayload } {
  if (!metadata.cartData) {
    throw new PermanentFulfillmentError('Stripe metadata is missing cartData');
  }
  let items: CompactCartItem[];
  try {
    items = JSON.parse(metadata.cartData) as CompactCartItem[];
  } catch {
    throw new PermanentFulfillmentError('Stripe metadata cartData is not valid JSON');
  }
  if (!Array.isArray(items)) {
    throw new PermanentFulfillmentError('Stripe metadata cartData is not an array');
  }
  const lang: Lang = metadata.lang === 'en' ? 'en' : 'it';
  const method = metadata.paymentMethod === 'twint' ? 'twint' : 'card';

  const expanded = items.map((it) => {
    if (typeof it.id !== 'string' || typeof it.qty !== 'number') {
      throw new PermanentFulfillmentError(
        `Stripe metadata cartData item has wrong shape: ${JSON.stringify(it)}`
      );
    }
    const p = getProductById(it.id);
    if (!p) throw new PermanentFulfillmentError(`Unknown product id: ${it.id}`);
    return {
      ticketId: it.id,
      name: lang === 'en' ? p.label.en : p.label.it,
      price: p.isFree ? 0 : p.priceCents,
      quantity: it.qty,
    };
  });

  const catalogSum = expanded.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = opts.chargedAmount;
  if (catalogSum !== total) {
    console.error(
      `Fulfillment total mismatch for ${opts.transactionId}: ` +
        `catalog sum ${catalogSum} != charged ${total}; using charged amount`
    );
  }

  const printMethodLabel =
    method === 'twint' ? 'TWINT' : lang === 'it' ? 'Carta' : 'Card';

  return {
    print: {
      items: expanded.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      total,
      transactionId: opts.transactionId,
      paymentMethod: printMethodLabel,
      lang,
    },
    log: {
      items: expanded.map((i) => ({
        ticketId: i.ticketId,
        ticketName: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
      total,
      paymentMethod: method,
      stripeIds: opts.stripeIds,
    },
  };
}
