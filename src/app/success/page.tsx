import { getStripe } from '@/lib/stripe';
import { fulfillCheckoutSession } from '@/lib/fulfillment';
import type { FulfillmentOutcome } from '@/lib/fulfillment';
import { RedirectHome } from './redirect-home';

export const dynamic = 'force-dynamic';

/**
 * TWINT return page. Server-rendered: fulfillment (print + log) runs HERE,
 * before the customer sees the page — the present customer gets their
 * receipt immediately. If the customer never reaches this page, the
 * reconcile sweep fulfills instead (Stripe Checkout fulfillment guidance:
 * never rely on the success page alone).
 *
 * Copy MUST branch on outcome (review finding): never claim success for a
 * failed print, an unpaid/expired session, or a garbage session id.
 */
export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;

  let outcome: FulfillmentOutcome | 'invalid-session' = 'invalid-session';
  if (sessionId && sessionId.startsWith('cs_')) {
    try {
      outcome = await fulfillCheckoutSession(getStripe(), sessionId);
    } catch {
      outcome = 'failed'; // disk/store error → show processing; sweep retries
    }
  }

  // fulfilled / already-fulfilled → receipt is printing or printed
  // pending / in-progress / failed → paid-or-processing; sweep finishes it
  // not-payable / invalid-session  → no success claim
  let title: string;
  let detail: string;
  if (outcome === 'fulfilled' || outcome === 'already-fulfilled') {
    title = 'Pagamento riuscito! / Payment successful!';
    detail = 'La ricevuta sta stampando. / Your receipt is printing.';
  } else if (
    outcome === 'pending' ||
    outcome === 'in-progress' ||
    outcome === 'failed' ||
    outcome === 'needs-attention'
  ) {
    title = 'Pagamento in elaborazione… / Payment processing…';
    detail =
      'La ricevuta verrà stampata a breve. / Your receipt will print shortly.';
  } else {
    title = 'Pagamento non completato / Payment not completed';
    detail =
      'Nessun addebito confermato. Riprova al chiosco. / No confirmed charge. Please try again at the kiosk.';
  }

  return (
    <div className="flex h-screen items-center justify-center">
      <RedirectHome seconds={6} />
      <div className="text-center">
        <p className="text-2xl font-bold text-gray-900">{title}</p>
        <p className="mt-4 text-lg text-gray-600">{detail}</p>
      </div>
    </div>
  );
}
