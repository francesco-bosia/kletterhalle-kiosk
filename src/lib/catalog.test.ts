import { describe, it, expect } from 'vitest';
import { validateCatalog, getHiddenGroup, getGroupsForStep, getProductById } from './catalog';

const wellFormedHidden = {
  currency: 'CHF',
  groups: [],
  hidden: {
    groups: [
      {
        id: 'penalty',
        layout: 'single-card',
        label: { it: 'Penale', en: 'Surcharge' },
        products: [
          { id: 'penalty', label: { it: 'Penale', en: 'Penalty' }, priceCents: 10000 },
        ],
      },
    ],
  },
};

describe('catalog hidden section', () => {
  it('exposes the penalty hidden group from the real catalog', () => {
    const g = getHiddenGroup('penalty');
    expect(g).toBeDefined();
    expect(g!.products[0].priceCents).toBe(10000);
  });

  it('does not leak hidden groups into the visible steps', () => {
    const stepGroupIds = [...getGroupsForStep(1), ...getGroupsForStep(2)].map((g) => g.id);
    expect(stepGroupIds).not.toContain('penalty');
  });

  it('resolves the hidden penalty product via getProductById (server pricing path)', () => {
    const p = getProductById('penalty');
    expect(p).toBeDefined();
    expect(p!.priceCents).toBe(10000);
  });

  it('accepts a well-formed hidden section', () => {
    expect(() => validateCatalog(wellFormedHidden)).not.toThrow();
  });

  it('rejects a hidden section whose groups is not an array', () => {
    expect(() =>
      validateCatalog({ currency: 'CHF', groups: [], hidden: { groups: {} } })
    ).toThrow(/hidden\.groups must be an array/);
  });

  it('rejects a hidden group missing a label', () => {
    expect(() =>
      validateCatalog({
        currency: 'CHF',
        groups: [],
        hidden: { groups: [{ id: 'penalty', layout: 'single-card', products: [] }] },
      })
    ).toThrow(/label must be/);
  });
});
