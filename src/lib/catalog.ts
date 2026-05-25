import catalogData from './catalog.json';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LocalizedText {
  it: string;
  en: string;
}

export interface Product {
  id: string;
  label: LocalizedText;
  sublabel?: LocalizedText;
  priceCents: number;
  isFree?: true;
}

export interface Group {
  id: string;
  step: 1 | 2;
  label: LocalizedText;
  note?: LocalizedText;
  layout: 'list' | 'single-card';
  products: Product[];
}

export interface Catalog {
  currency: string;
  groups: Group[];
}

// ── Shape validator ────────────────────────────────────────────────────────────

function validateCatalog(data: unknown): asserts data is Catalog {
  if (typeof data !== 'object' || data === null) {
    throw new Error('catalog.json: expected an object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.currency !== 'CHF') {
    throw new Error('catalog.json: currency must be "CHF"');
  }

  if (!Array.isArray(obj.groups)) {
    throw new Error('catalog.json: groups must be an array');
  }

  for (let gi = 0; gi < obj.groups.length; gi++) {
    const g = obj.groups[gi] as Record<string, unknown>;

    if (typeof g.id !== 'string' || g.id === '') {
      throw new Error(`catalog.json: groups[${gi}].id must be a non-empty string`);
    }
    if (g.step !== 1 && g.step !== 2) {
      throw new Error(`catalog.json: groups[${gi}].step must be 1 or 2`);
    }
    if (!isLocalizedText(g.label)) {
      throw new Error(`catalog.json: groups[${gi}].label must be {it, en}`);
    }
    if (g.layout !== 'list' && g.layout !== 'single-card') {
      throw new Error(`catalog.json: groups[${gi}].layout must be "list" or "single-card"`);
    }
    if (!Array.isArray(g.products)) {
      throw new Error(`catalog.json: groups[${gi}].products must be an array`);
    }

    for (let pi = 0; pi < g.products.length; pi++) {
      const p = g.products[pi] as Record<string, unknown>;

      if (typeof p.id !== 'string' || p.id === '') {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].id must be a non-empty string`);
      }
      if (!isLocalizedText(p.label)) {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].label must be {it, en}`);
      }
      if (p.sublabel !== undefined && !isLocalizedText(p.sublabel)) {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].sublabel must be {it, en}`);
      }
      if (p.isFree !== true && typeof p.priceCents !== 'number') {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].priceCents must be a number`);
      }
      if (typeof p.priceCents === 'number' && p.priceCents < 0) {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].priceCents must be >= 0`);
      }
      if (p.isFree !== undefined && p.isFree !== true) {
        throw new Error(`catalog.json: groups[${gi}].products[${pi}].isFree must be true if present`);
      }
    }
  }
}

function isLocalizedText(value: unknown): value is LocalizedText {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.it === 'string' && typeof v.en === 'string';
}

// Validate at module load time — will fail `next build` on malformed JSON
validateCatalog(catalogData);

// ── Exports ────────────────────────────────────────────────────────────────────

export const CATALOG: Catalog = catalogData;

export function getGroupsForStep(step: 1 | 2): Group[] {
  return CATALOG.groups.filter((g) => g.step === step);
}

export function getProductById(id: string): Product | undefined {
  for (const group of CATALOG.groups) {
    const found = group.products.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}
