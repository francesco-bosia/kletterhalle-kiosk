// ── Language type ──────────────────────────────────────────────────────────────

export type Lang = 'it' | 'en';

// ── Messages ───────────────────────────────────────────────────────────────────

const MESSAGES = {
  chrome: {
    stepLabel: { it: 'PASSO', en: 'STEP' },
    continueLabel: { it: 'Continua', en: 'Continue' },
    backLabel: { it: 'Indietro', en: 'Back' },
    cancelLabel: { it: 'Annulla', en: 'Cancel' },
    confirmLabel: { it: 'Conferma', en: 'Confirm' },
    closeLabel: { it: 'Chiudi', en: 'Close' },
  },
  steps: {
    tickets: { it: 'Biglietti', en: 'Tickets' },
    extras: { it: 'Extra', en: 'Extras' },
    summary: { it: 'Riepilogo', en: 'Summary' },
    payment: { it: 'Pagamento', en: 'Payment' },
  },
  payment: {
    chooseMethod: { it: 'Scegli il metodo di pagamento', en: 'Choose payment method' },
    payWithCard: { it: 'Paga con carta', en: 'Pay with card' },
    payWithTwint: { it: 'Paga con TWINT', en: 'Pay with TWINT' },
    processing: { it: 'Elaborazione in corso...', en: 'Processing...' },
    tapCard: { it: 'Avvicina la carta al lettore', en: 'Tap your card on the reader' },
    waitingPayment: { it: 'In attesa del pagamento...', en: 'Waiting for payment...' },
  },
  idle: {
    title: { it: 'Sei ancora qui?', en: 'Still there?' },
    message: {
      it: 'La sessione scadrà tra poco. Tocca lo schermo per continuare.',
      en: 'The session will expire soon. Tap the screen to continue.',
    },
    expireWarning: { it: 'Sessione scaduta', en: 'Session expired' },
  },
  success: {
    title: { it: 'Pagamento riuscito!', en: 'Payment successful!' },
    receipt: { it: 'Ricevuta in stampa...', en: 'Printing receipt...' },
    thankYou: { it: 'Grazie e buona arrampicata!', en: 'Thank you and enjoy your climb!' },
    newSession: { it: 'Nuova sessione', en: 'New session' },
  },
  failed: {
    title: { it: 'Pagamento fallito', en: 'Payment failed' },
    retry: { it: 'Riprova', en: 'Retry' },
    errorMessage: { it: 'Si è verificato un errore. Riprova.', en: 'An error occurred. Please try again.' },
  },
  cart: {
    empty: { it: 'Carrello vuoto', en: 'Cart is empty' },
    total: { it: 'Totale', en: 'Total' },
    items: { it: 'articoli', en: 'items' },
    item: { it: 'articolo', en: 'item' },
    free: { it: 'Gratuito', en: 'Free' },
    quantity: { it: 'Quantità', en: 'Quantity' },
    remove: { it: 'Rimuovi', en: 'Remove' },
  },
  products: {
    addToCart: { it: 'Aggiungi', en: 'Add' },
    removeFromCart: { it: 'Rimuovi', en: 'Remove' },
  },
} as const;

// ── Helper ─────────────────────────────────────────────────────────────────────

type MessageValue = string | { readonly [key: string]: MessageValue };

/**
 * Navigate a dot-separated key path into the MESSAGES object
 * and return the string for the given language.
 *
 * @example t('chrome.continueLabel', 'it') // => 'Continua'
 */
export function t(key: string, lang: Lang): string {
  const parts = key.split('.');
  let node: MessageValue = MESSAGES as unknown as MessageValue;

  for (const part of parts) {
    if (typeof node === 'object' && node !== null && part in node) {
      node = (node as Record<string, MessageValue>)[part];
    } else {
      return key; // fallback: return the key itself
    }
  }

  if (typeof node === 'string') {
    return node;
  }

  if (typeof node === 'object' && node !== null && lang in node) {
    return (node as Record<string, string>)[lang];
  }

  return key; // fallback
}
