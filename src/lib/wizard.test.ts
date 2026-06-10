import { describe, it, expect } from 'vitest';
import { wizardReducer, createInitialState } from './wizard';

describe('wizard penalty view', () => {
  it('defaults to the normal view', () => {
    expect(createInitialState().view).toBe('normal');
  });

  it('ENTER_PENALTY clears the cart and switches to the penalty view at step 1', () => {
    const start = {
      ...createInitialState(),
      step: 3 as const,
      cart: [
        { productId: 'adult', groupId: 'daily', labelIt: 'Adulti', labelEn: 'Adult', priceCents: 1600, quantity: 2 },
      ],
    };
    const next = wizardReducer(start, { type: 'ENTER_PENALTY' });
    expect(next.view).toBe('penalty');
    expect(next.step).toBe(1);
    expect(next.cart).toEqual([]);
  });

  it('EXIT_PENALTY clears the penalty line and restores the normal view', () => {
    const start = {
      ...createInitialState(),
      view: 'penalty' as const,
      cart: [
        { productId: 'penalty', groupId: 'penalty', labelIt: 'Penale', labelEn: 'Penalty', priceCents: 10000, quantity: 1 },
      ],
    };
    const next = wizardReducer(start, { type: 'EXIT_PENALTY' });
    expect(next.view).toBe('normal');
    expect(next.step).toBe(1);
    expect(next.cart).toEqual([]);
  });

  it('RESET_SESSION restores the normal view', () => {
    const start = { ...createInitialState(), view: 'penalty' as const };
    const next = wizardReducer(start, { type: 'RESET_SESSION' });
    expect(next.view).toBe('normal');
  });
});
