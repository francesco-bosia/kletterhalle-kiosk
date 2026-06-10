# Hidden Penalty Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hidden CHF 100 "Penale" (penalty) screen, reachable by tapping the Step-1 title 5 times quickly, that starts an isolated transaction and flows through the normal summary → payment pipeline.

**Architecture:** A `hidden` section in `catalog.json` (separate from the visible `groups`) holds the penalty product. A new `view: 'normal' | 'penalty'` field on the wizard state, toggled by `ENTER_PENALTY` / `EXIT_PENALTY` actions, switches `WizardChrome` from the normal step-1 content to a new `PenaltyScreen` (a single-card layout mirroring the shoe rental screen). A pure tap-counter (`registerTap`) plus a thin `useSecretTap` hook wire the secret gesture onto the Step-1 title. The penalty is a normal cart line, so summary, payment, receipt, and logging are reused unchanged.

**Tech Stack:** Next.js 16 / React 19, TypeScript, Tailwind CSS, Vitest (node environment — only `src/**/*.test.ts` pure-logic tests; components are verified via `next build` + manual run, matching the existing codebase).

---

## File Structure

- `src/lib/catalog.json` — **modify**: add top-level `hidden` section with the penalty group.
- `src/lib/catalog.ts` — **modify**: add `HiddenGroup` type + `hidden` on `Catalog`, refactor group validation into `validateGroupShape`, validate the `hidden` section, export `validateCatalog`, add `getHiddenGroup`, and make `getProductById` scan hidden groups too (so the server payment path can price the penalty).
- `src/lib/catalog.test.ts` — **create**: tests for the hidden section + validator.
- `src/lib/secret-tap.ts` — **create**: pure tap-counter logic.
- `src/lib/secret-tap.test.ts` — **create**: tests for `registerTap`.
- `src/lib/use-secret-tap.ts` — **create**: thin React hook wrapping `registerTap`.
- `src/lib/wizard.ts` — **modify**: add `view` field, `ENTER_PENALTY` / `EXIT_PENALTY` actions + reducer cases.
- `src/lib/wizard.test.ts` — **create**: reducer tests for the new actions.
- `src/components/wizard/PenaltyScreen.tsx` — **create**: the penalty single-card screen.
- `src/components/wizard/StepTitle.tsx` — **modify**: optional `onSecretActivate` prop wiring the tap gesture.
- `src/components/wizard/Step1Tickets.tsx` — **modify**: pass `onSecretActivate` dispatching `ENTER_PENALTY`.
- `src/components/wizard/WizardChrome.tsx` — **modify**: render `PenaltyScreen` while in penalty view.
- `src/components/wizard/StepFooter.tsx` — **modify**: in penalty view, Continue routes to step 3.

---

## Task 1: Catalog hidden section + helpers

**Files:**
- Modify: `src/lib/catalog.json`
- Modify: `src/lib/catalog.ts`
- Test: `src/lib/catalog.test.ts`

- [ ] **Step 1: Add the `hidden` section to `catalog.json`**

Add this top-level key after the `groups` array (sibling of `currency` and `groups`). The closing of the file changes from `]\n}` to `],` followed by the block below and a final `}`:

```jsonc
  "hidden": {
    "groups": [
      {
        "id": "penalty",
        "layout": "single-card",
        "label": { "it": "Penale", "en": "Surcharge" },
        "products": [
          {
            "id": "penalty",
            "label": { "it": "Penale", "en": "Penalty" },
            "priceCents": 10000
          }
        ]
      }
    ]
  }
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/catalog.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test -- src/lib/catalog.test.ts`
Expected: FAIL — `validateCatalog` and `getHiddenGroup` are not exported yet.

- [ ] **Step 4: Update `catalog.ts` types**

Replace the `Group` / `Catalog` type block (lines ~18-30) so it reads:

```ts
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
```

- [ ] **Step 5: Refactor validation + validate the hidden section**

Replace the body of `validateCatalog` (the part from `if (!Array.isArray(obj.groups))` through the end of its group loop) and add the `validateGroupShape` helper. The new `validateCatalog` and helper:

```ts
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
```

Note: the old inline `isLocalizedText` function stays as-is. The module-load call `validateCatalog(catalogData)` near the bottom is unchanged (now references the exported function).

- [ ] **Step 6: Add `getHiddenGroup` and make `getProductById` hidden-aware**

Replace the existing `getProductById` and append `getHiddenGroup` at the bottom of `catalog.ts`. `getProductById` must also scan hidden groups so the server payment path (`src/app/api/payments/create/route.ts`, and `expandCompactItems` in `cart.ts`) can price the penalty:

```ts
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/lib/catalog.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/catalog.json src/lib/catalog.ts src/lib/catalog.test.ts
git commit -m "feat(catalog): add hidden products section with penalty"
```

---

## Task 2: Secret-tap pure logic

**Files:**
- Create: `src/lib/secret-tap.ts`
- Test: `src/lib/secret-tap.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/secret-tap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { INITIAL_TAP_STATE, registerTap } from './secret-tap';

describe('registerTap', () => {
  it('counts consecutive quick taps', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 200, 1000);
    s = registerTap(s, 400, 1000);
    expect(s.count).toBe(3);
  });

  it('restarts the run when a tap arrives after the gap', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 500, 1000);
    expect(s.count).toBe(2);
    s = registerTap(s, 2000, 1000); // 1500ms gap > 1000
    expect(s.count).toBe(1);
  });

  it('treats a gap exactly equal to maxGap as still within the run', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 1000, 1000); // gap == maxGap, not > maxGap
    expect(s.count).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/secret-tap.test.ts`
Expected: FAIL — module `./secret-tap` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/secret-tap.ts`:

```ts
export interface TapState {
  count: number;
  lastTapAt: number | null;
}

export const INITIAL_TAP_STATE: TapState = { count: 0, lastTapAt: null };

/**
 * Pure tap-counter step. Increments the run when a tap arrives within `maxGapMs`
 * of the previous tap; otherwise restarts the run at 1.
 */
export function registerTap(state: TapState, now: number, maxGapMs: number): TapState {
  if (state.lastTapAt !== null && now - state.lastTapAt > maxGapMs) {
    return { count: 1, lastTapAt: now };
  }
  return { count: state.count + 1, lastTapAt: now };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- src/lib/secret-tap.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/secret-tap.ts src/lib/secret-tap.test.ts
git commit -m "feat: add pure secret-tap counter logic"
```

---

## Task 3: useSecretTap hook

**Files:**
- Create: `src/lib/use-secret-tap.ts`

No unit test — the Vitest setup is node-only with no React testing library, matching how the rest of the components/hooks are left to `next build` + manual verification. The pure logic is already covered by Task 2.

- [ ] **Step 1: Write the hook**

Create `src/lib/use-secret-tap.ts`:

```ts
'use client';

import { useCallback, useRef } from 'react';
import { INITIAL_TAP_STATE, registerTap, type TapState } from './secret-tap';

interface UseSecretTapOptions {
  count: number;
  maxGapMs: number;
  onActivate: () => void;
}

/**
 * Returns a tap handler that fires `onActivate` once `count` taps occur with
 * less than `maxGapMs` between consecutive taps. Uses Date.now() for timing
 * (client-only). The run resets after firing.
 */
export function useSecretTap({ count, maxGapMs, onActivate }: UseSecretTapOptions): () => void {
  const stateRef = useRef<TapState>(INITIAL_TAP_STATE);

  return useCallback(() => {
    const next = registerTap(stateRef.current, Date.now(), maxGapMs);
    if (next.count >= count) {
      stateRef.current = INITIAL_TAP_STATE;
      onActivate();
      return;
    }
    stateRef.current = next;
  }, [count, maxGapMs, onActivate]);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/use-secret-tap.ts
git commit -m "feat: add useSecretTap hook"
```

---

## Task 4: Wizard penalty view state

**Files:**
- Modify: `src/lib/wizard.ts`
- Test: `src/lib/wizard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/wizard.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- src/lib/wizard.test.ts`
Expected: FAIL — `view` is undefined and `ENTER_PENALTY` / `EXIT_PENALTY` are unhandled.

- [ ] **Step 3: Add `view` to the state type**

In `src/lib/wizard.ts`, add `view` to the `WizardState` interface (after `lang: Lang;`):

```ts
  lang: Lang;
  view: 'normal' | 'penalty';
```

- [ ] **Step 4: Add the new action types**

In the `WizardAction` union, add two members (e.g. after `RESET_SESSION`):

```ts
  | { type: 'RESET_SESSION' }
  | { type: 'ENTER_PENALTY' }
  | { type: 'EXIT_PENALTY' };
```

- [ ] **Step 5: Initialize `view` in `createInitialState`**

Add `view: 'normal',` to the returned object (after `lang: 'it',`):

```ts
    lang: 'it',
    view: 'normal',
```

- [ ] **Step 6: Handle the new actions in the reducer**

Add these cases before `case 'RESET_SESSION':`:

```ts
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
```

(`cartReducer` is already imported at the top of `wizard.ts`.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- src/lib/wizard.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Commit**

```bash
git add src/lib/wizard.ts src/lib/wizard.test.ts
git commit -m "feat(wizard): add penalty view state + enter/exit actions"
```

---

## Task 5: PenaltyScreen component

**Files:**
- Create: `src/components/wizard/PenaltyScreen.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/wizard/PenaltyScreen.tsx`:

```tsx
'use client';

import { useWizard } from '@/lib/wizard-context';
import { getHiddenGroup } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { StepTitle } from '@/components/wizard/StepTitle';
import { QuantityControl } from '@/components/wizard/QuantityControl';

export function PenaltyScreen() {
  const { state, dispatch } = useWizard();
  const group = getHiddenGroup('penalty');
  const product = group?.products[0];

  if (!group || !product) return null;

  const quantity =
    state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

  return (
    <div>
      <StepTitle
        it="Accesso senza titolo valido"
        en="Access without a valid pass"
      />

      {/* Single product card */}
      <div className="w-full max-w-sm mx-auto bg-gray-100 rounded-3xl p-5">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-extrabold tracking-[0.2em] text-black uppercase">
            {group.label.it}
          </h3>
          <span className="text-sm italic text-gray-400">
            {group.label.en}
          </span>
        </div>

        {/* Product name */}
        <div className="text-center mb-4">
          <h2 className="text-3xl font-black text-black">
            {product.label.it}
          </h2>
          <p className="text-lg italic text-gray-400 mt-1">
            {product.label.en}
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-4">
          <p className="text-2xl font-black text-black">
            {formatChf(product.priceCents)}
          </p>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-4" />

        {/* Quantity selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-black">Quanti?</p>
            <p className="text-sm italic text-gray-400">How many?</p>
          </div>
          <QuantityControl
            quantity={quantity}
            onInc={() =>
              dispatch({
                type: 'INC',
                productId: product.id,
                groupId: group.id,
                labelIt: product.label.it,
                labelEn: product.label.en,
                priceCents: product.priceCents,
              })
            }
            onDec={() =>
              dispatch({
                type: 'DEC',
                productId: product.id,
              })
            }
          />
        </div>
      </div>

      {/* Back link — exits penalty mode */}
      <button
        type="button"
        onClick={() => dispatch({ type: 'EXIT_PENALTY' })}
        className="mt-4 w-full text-center text-sm text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600"
      >
        In dietro
        <br />
        <span className="text-xs">Back</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors. (`PenaltyScreen` is unused until Task 7 — that is fine for `tsc`.)

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/PenaltyScreen.tsx
git commit -m "feat: add PenaltyScreen single-card component"
```

---

## Task 6: Wire the secret gesture onto the Step-1 title

**Files:**
- Modify: `src/components/wizard/StepTitle.tsx`
- Modify: `src/components/wizard/Step1Tickets.tsx`

- [ ] **Step 1: Add `onSecretActivate` to `StepTitle`**

Replace the contents of `src/components/wizard/StepTitle.tsx` with:

```tsx
'use client';

import { useSecretTap } from '@/lib/use-secret-tap';

interface StepTitleProps {
  it: string;
  en: string;
  descriptionIt?: string;
  descriptionEn?: string;
  /** When provided, 5 quick taps (<1s apart) on the heading fire this callback. */
  onSecretActivate?: () => void;
}

/**
 * Standard title block for wizard steps.
 * Renders Italian title as display heading, English as italic subtitle.
 * Optional bilingual description block, left-aligned.
 */
export function StepTitle({ it, en, descriptionIt, descriptionEn, onSecretActivate }: StepTitleProps) {
  const handleSecretTap = useSecretTap({
    count: 5,
    maxGapMs: 1000,
    onActivate: onSecretActivate ?? (() => {}),
  });

  return (
    <div className="mb-6">
      <h1
        className="text-4xl font-black text-black tracking-tight leading-[1.05]"
        onClick={onSecretActivate ? handleSecretTap : undefined}
      >
        {it}
      </h1>
      <p className="text-lg italic text-gray-400 mt-1">
        {en}
      </p>

      {(descriptionIt || descriptionEn) && (
        <>
          <p className="text-base text-gray-500 mt-6">
            {descriptionIt}
            {descriptionIt && descriptionEn && <br />}
            {descriptionEn}
          </p>
          <hr className="border-gray-200 mt-3" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Pass `onSecretActivate` from `Step1Tickets`**

In `src/components/wizard/Step1Tickets.tsx`, update the `StepTitle` usage (lines ~15-18) to dispatch `ENTER_PENALTY`:

```tsx
      <StepTitle
        it="Scegli i biglietti"
        en="Choose your tickets"
        onSecretActivate={() => dispatch({ type: 'ENTER_PENALTY' })}
      />
```

(`dispatch` is already available from `useWizard()` in this component.)

- [ ] **Step 3: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/wizard/StepTitle.tsx src/components/wizard/Step1Tickets.tsx
git commit -m "feat: wire 5-tap secret gesture onto step-1 title"
```

---

## Task 7: Render PenaltyScreen + route Continue to summary

**Files:**
- Modify: `src/components/wizard/WizardChrome.tsx`
- Modify: `src/components/wizard/StepFooter.tsx`

- [ ] **Step 1: Render `PenaltyScreen` in `WizardChrome`**

In `src/components/wizard/WizardChrome.tsx`, add the import:

```tsx
import { PenaltyScreen } from '@/components/wizard/PenaltyScreen';
```

Then replace the `<main>` body. The penalty view replaces the shopping steps (1 and 2) so the operator can never reach the shoe screen inside a penalty transaction; once Continue advances to step 3, the normal summary/payment render:

```tsx
      <main className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
        {state.phase === 'success' ? (
          <Step4Payment />
        ) : state.view === 'penalty' && state.step < 3 ? (
          <PenaltyScreen />
        ) : (
          <>
            {state.step === 1 && <Step1Tickets />}
            {state.step === 2 && <Step2Shoes />}
            {state.step === 3 && <Step3Summary />}
            {state.step === 4 && <Step4Payment />}
          </>
        )}
      </main>
```

- [ ] **Step 2: Route the footer's Continue to summary in penalty view**

In `src/components/wizard/StepFooter.tsx`, destructure `view` and update `handleContinue`:

```tsx
  const { state, dispatch } = useWizard();
  const { step, cart, view } = state;
```

```tsx
  function handleContinue() {
    if (isContinueDisabled) return;
    const nextStep =
      view === 'penalty' && step < 3 ? 3 : ((step + 1) as 1 | 2 | 3 | 4);
    dispatch({ type: 'GO_TO_STEP', step: nextStep });
  }
```

(The existing `isContinueDisabled = step === 1 && total === 0` already blocks Continue when the penalty quantity is 0, since the cart total is 0.)

- [ ] **Step 3: Verify it type-checks and builds**

Run: `npx tsc --noEmit && npm run build`
Expected: no type errors; `next build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/wizard/WizardChrome.tsx src/components/wizard/StepFooter.tsx
git commit -m "feat: render penalty screen and route continue to summary"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — all suites green, including the new `catalog`, `secret-tap`, and `wizard` tests, and the pre-existing `payload-helpers` / `completion-client` tests.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev`, open the app, then:
1. On Step 1, tap the title "Scegli i biglietti" 5 times quickly (<1s between taps). → The penalty screen ("Accesso senza titolo valido", Penale CHF 100) replaces the ticket list.
2. Increase the penalty quantity to 1 → footer total shows CHF 100; tap **Continua** → lands on the **Summary** (step 3) showing the Penale line, not the shoe screen.
3. Tap **Pagamento** → reaches the payment step normally (no payment needs to complete for this check).
4. Go back to Step 1 (e.g. via the header pills / reset), trigger the penalty screen again, then tap **In dietro** → returns to the normal ticket list with an empty cart.
5. Confirm that slow taps (>1s apart) on the title do **not** open the penalty screen.

Expected: all behaviors as described.

- [ ] **Step 4: Final commit (if any uncommitted changes remain)**

```bash
git status
# if clean, nothing to do
```

---

## Notes for the implementer

- Vitest runs in a **node** environment and only includes `src/**/*.test.ts` — do not add `.test.tsx` files expecting them to run; component behavior is verified by `next build` + the manual smoke test.
- The penalty is a plain cart line (`productId: 'penalty'`). The server payment route (`src/app/api/payments/create/route.ts`) prices every item via `getProductById`, and `expandCompactItems` in `cart.ts` does the same — both would throw `Unknown product id: penalty` unless `getProductById` scans hidden groups. Task 1 Step 6 fixes this; do not skip it. With that in place, summary, Stripe metadata, the printed receipt, and the transaction log all work without further changes.
- Keep the app chrome (4-pill step header) exactly as-is; the single "STEP 2/4" pill in `design/penale_hidden_screen.png` is illustrative only.
