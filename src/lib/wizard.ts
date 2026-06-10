import type { Dispatch } from 'react';
import type { Lang } from './i18n';
import { cartReducer, type CartLine, type CartAction } from './cart';

// ── State type ─────────────────────────────────────────────────────────────────

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  phase: 'shopping' | 'paying' | 'success' | 'failed';
  cart: CartLine[];
  lang: Lang;
  view: 'normal' | 'penalty';
  payment: {
    method: 'card' | 'twint' | null;
    paymentIntentId: string | null;
    clientSecret: string | null;
    transactionId: string | null;
    statusMessage: string | null;
    error: string | null;
  };
}

// ── Action types ───────────────────────────────────────────────────────────────

export type WizardAction =
  | { type: 'INC'; productId: string; groupId: string; labelIt: string; labelEn: string; priceCents: number }
  | { type: 'DEC'; productId: string }
  | { type: 'SET'; productId: string; quantity: number }
  | { type: 'CLEAR' }
  | { type: 'GO_TO_STEP'; step: 1 | 2 | 3 | 4 }
  | { type: 'SET_LANG'; lang: Lang }
  | { type: 'SET_METHOD'; method: 'card' | 'twint' }
  | { type: 'PAYMENT_STARTED'; paymentIntentId: string; clientSecret: string }
  | { type: 'PAYMENT_SUCCEEDED'; transactionId: string }
  | { type: 'PAYMENT_FAILED'; error: string }
  | { type: 'RETRY_PAYMENT' }
  | { type: 'RESET_SESSION' }
  | { type: 'ENTER_PENALTY' }
  | { type: 'EXIT_PENALTY' };

// ── Initial state factory ──────────────────────────────────────────────────────

export function createInitialState(): WizardState {
  return {
    step: 1,
    phase: 'shopping',
    cart: [],
    lang: 'it',
    view: 'normal',
    payment: {
      method: null,
      paymentIntentId: null,
      clientSecret: null,
      transactionId: null,
      statusMessage: null,
      error: null,
    },
  };
}

// ── Reducer ────────────────────────────────────────────────────────────────────

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    // Cart actions — delegated to cart reducer
    case 'INC':
    case 'DEC':
    case 'SET':
    case 'CLEAR':
      return {
        ...state,
        cart: cartReducer(state.cart, action as CartAction),
      };

    case 'GO_TO_STEP':
      return { ...state, step: action.step };

    case 'SET_LANG':
      return { ...state, lang: action.lang };

    case 'SET_METHOD':
      return {
        ...state,
        payment: { ...state.payment, method: action.method },
      };

    case 'PAYMENT_STARTED':
      return {
        ...state,
        phase: 'paying',
        payment: {
          ...state.payment,
          paymentIntentId: action.paymentIntentId,
          clientSecret: action.clientSecret,
          statusMessage: null,
          error: null,
        },
      };

    case 'PAYMENT_SUCCEEDED':
      return {
        ...state,
        phase: 'success',
        payment: {
          ...state.payment,
          transactionId: action.transactionId,
        },
      };

    case 'PAYMENT_FAILED':
      return {
        ...state,
        phase: 'failed',
        payment: {
          ...state.payment,
          error: action.error,
        },
      };

    case 'RETRY_PAYMENT':
      return {
        ...state,
        phase: 'shopping',
        step: 4,
        payment: {
          ...state.payment,
          method: null,
          paymentIntentId: null,
          clientSecret: null,
          transactionId: null,
          statusMessage: null,
          error: null,
        },
      };

    case 'ENTER_PENALTY':
      return {
        ...state,
        view: 'penalty',
        step: 1,
        cart: cartReducer(state.cart, { type: 'CLEAR' }),
      };

    case 'EXIT_PENALTY':
      return {
        ...state,
        view: 'normal',
        step: 1,
        cart: cartReducer(state.cart, { type: 'CLEAR' }),
      };

    case 'RESET_SESSION':
      return createInitialState();

    default:
      return state;
  }
}

// ── Context type ───────────────────────────────────────────────────────────────

export interface WizardContext {
  state: WizardState;
  dispatch: Dispatch<WizardAction>;
}
