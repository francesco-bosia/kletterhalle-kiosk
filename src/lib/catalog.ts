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

export type HiddenGroup = Omit<Group, 'step'>;

export interface Catalog {
  currency: string;
  groups: Group[];
  hidden?: { groups: HiddenGroup[] };
}

// ── Shape validator ────────────────────────────────────────────────────────────

export function validateCatalog(data: unknown): asserts data is Catalog {
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
    validateGroupShape(obj.groups[gi] as Record<string, unknown>, `groups[${gi}]`, true);
  }

  if (obj.hidden !== undefined) {
    if (typeof obj.hidden !== 'object' || obj.hidden === null) {
      throw new Error('catalog.json: hidden must be an object');
    }
    const hidden = obj.hidden as Record<string, unknown>;
    if (!Array.isArray(hidden.groups)) {
      throw new Error('catalog.json: hidden.groups must be an array');
    }
    for (let gi = 0; gi < hidden.groups.length; gi++) {
      validateGroupShape(hidden.groups[gi] as Record<string, unknown>, `hidden.groups[${gi}]`, false);
    }
  }
}

function validateGroupShape(
  g: Record<string, unknown>,
  path: string,
  requireStep: boolean
): void {
  if (typeof g.id !== 'string' || g.id === '') {
    throw new Error(`catalog.json: ${path}.id must be a non-empty string`);
  }
  if (requireStep && g.step !== 1 && g.step !== 2) {
    throw new Error(`catalog.json: ${path}.step must be 1 or 2`);
  }
  if (!isLocalizedText(g.label)) {
    throw new Error(`catalog.json: ${path}.label must be {it, en}`);
  }
  if (g.layout !== 'list' && g.layout !== 'single-card') {
    throw new Error(`catalog.json: ${path}.layout must be "list" or "single-card"`);
  }
  if (!Array.isArray(g.products)) {
    throw new Error(`catalog.json: ${path}.products must be an array`);
  }

  for (let pi = 0; pi < g.products.length; pi++) {
    const p = g.products[pi] as Record<string, unknown>;

    if (typeof p.id !== 'string' || p.id === '') {
      throw new Error(`catalog.json: ${path}.products[${pi}].id must be a non-empty string`);
    }
    if (!isLocalizedText(p.label)) {
      throw new Error(`catalog.json: ${path}.products[${pi}].label must be {it, en}`);
    }
    if (p.sublabel !== undefined && !isLocalizedText(p.sublabel)) {
      throw new Error(`catalog.json: ${path}.products[${pi}].sublabel must be {it, en}`);
    }
    if (p.isFree !== true && typeof p.priceCents !== 'number') {
      throw new Error(`catalog.json: ${path}.products[${pi}].priceCents must be a number`);
    }
    if (typeof p.priceCents === 'number' && p.priceCents < 0) {
      throw new Error(`catalog.json: ${path}.products[${pi}].priceCents must be >= 0`);
    }
    if (p.isFree !== undefined && p.isFree !== true) {
      throw new Error(`catalog.json: ${path}.products[${pi}].isFree must be true if present`);
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
  const allGroups = [...CATALOG.groups, ...(CATALOG.hidden?.groups ?? [])];
  for (const group of allGroups) {
    const found = group.products.find((p) => p.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getHiddenGroup(id: string): HiddenGroup | undefined {
  return CATALOG.hidden?.groups.find((g) => g.id === id);
}
