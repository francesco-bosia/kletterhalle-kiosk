import { describe, it, expect } from 'vitest';
import { wizardReducer, createInitialState, isContinueDisabled } from './wizard';

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

describe('isContinueDisabled', () => {
  it('allows leaving the tickets step (step 1) with an empty cart', () => {
    expect(isContinueDisabled('normal', 1, 0)).toBe(false);
  });

  it('blocks leaving the shoes step (step 2) with an empty cart', () => {
    expect(isContinueDisabled('normal', 2, 0)).toBe(true);
  });

  it('allows leaving the shoes step (step 2) once the cart has a total', () => {
    expect(isContinueDisabled('normal', 2, 1600)).toBe(false);
  });

  it('blocks the penalty view while its total is zero', () => {
    expect(isContinueDisabled('penalty', 1, 0)).toBe(true);
  });

  it('allows the penalty view once its total is set', () => {
    expect(isContinueDisabled('penalty', 1, 10000)).toBe(false);
  });
});
