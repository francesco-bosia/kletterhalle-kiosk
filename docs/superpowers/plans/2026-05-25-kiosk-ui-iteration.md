# Kiosk UI Iteration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the kiosk wizard UI to match the approved design mockups — fix typography, add a 4-pill stepper, center the wizard on desktop, remove the language toggle, and make the receipt Italian-only.

**Architecture:** Two new shared primitives (`DeviceFrame`, `StepTitle`), one utility helper (`cart-rules`), and targeted edits to existing wizard components. All changes are visual/structural; no reducer changes, no new error paths.

**Tech Stack:** Next.js 15, React 19, TypeScript 5, Tailwind CSS v4

---

## File Structure

```
src/
├── lib/
│   ├── money.ts                    # modify: formatChf drops .00
│   └── cart-rules.ts               # create: hasDailyPass helper
├── app/
│   └── globals.css                 # modify: body bg, device frame styles
└── components/wizard/
    ├── DeviceFrame.tsx             # create: desktop card chrome
    ├── StepTitle.tsx               # create: shared title block
    ├── WizardChrome.tsx            # modify: wrap in DeviceFrame
    ├── StepHeader.tsx              # rewrite: 4-pill stepper, remove lang toggle
    ├── StepFooter.tsx              # modify: bilingual continue, larger total
    ├── Step1Tickets.tsx            # modify: use StepTitle, left-align
    ├── Step2Shoes.tsx              # modify: use StepTitle, restructure card
    ├── Step3Summary.tsx            # modify: use StepTitle, left-align
    ├── Step4Success.tsx            # modify: Italian-only
    ├── ProductRow.tsx              # modify: heavier labels
    ├── ProductGroupHeader.tsx      # modify: heavier caps, included note prop
    └── QuantityControl.tsx         # modify: larger, primary + button
```

---

## Task 1: Add `cart-rules.ts` helper

**Files:**
- Create: `src/lib/cart-rules.ts`

- [ ] **Step 1: Create cart rules module**

```typescript
// src/lib/cart-rules.ts
import type { CartLine } from './cart';

const DAILY_PASS_IDS = ['adult', 'student', 'teen', 'child', 'family'];
const DAILY_GROUP_ID = 'daily';
const SHOWER_ID = 'shower';

/**
 * Returns true if the cart contains any daily pass product.
 * Used to show "already included" notes for add-ons like showers.
 */
export function hasDailyPass(cart: CartLine[]): boolean {
  return cart.some(
    (l) =>
      l.quantity > 0 &&
      (DAILY_PASS_IDS.includes(l.productId) || l.groupId === DAILY_GROUP_ID)
  );
}

/**
 * Returns true if the cart contains only the standalone shower product.
 * Used to differentiate "shower only" from "shower included with daily pass".
 */
export function hasShowerOnly(cart: CartLine[]): boolean {
  return cart.some((l) => l.quantity > 0 && l.productId === SHOWER_ID);
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/cart-rules.ts
git commit -m "feat: add cart rules helper for daily pass detection"
```

---

## Task 2: Update `formatChf` to drop trailing `.00`

**Files:**
- Modify: `src/lib/money.ts:13-18`

- [ ] **Step 1: Read current formatChf implementation**

```bash
cat src/lib/money.ts
```

- [ ] **Step 2: Replace formatChf to drop trailing zeros**

```typescript
export function formatChf(cents: number): string {
  const whole = cents % 100 === 0;
  return whole ? `CHF ${cents / 100}` : `CHF ${(cents / 100).toFixed(2)}`;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/money.ts
git commit -m "refactor(money): drop trailing .00 from whole franc amounts"
```

---

## Task 3: Update `globals.css` for device frame

**Files:**
- Modify: `src/app/globals.css:1-48`

- [ ] **Step 1: Read current globals.css**

```bash
cat src/app/globals.css
```

- [ ] **Step 2: Replace body background and add device frame styles**

Find the `:root` section and the `body` rules. Replace them with:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #000000;
  --frame-bg: #f4f4f5; /* zinc-100 */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
}

/* Kiosk reset */
* {
  -webkit-tap-highlight-color: transparent;
}

html, body {
  height: 100%;
  overflow: hidden;
  background: var(--frame-bg);
}

body {
  background: var(--frame-bg);
  color: var(--foreground);
  font-family: var(--font-sans), Arial, Helvetica, sans-serif;
  touch-action: manipulation;
  user-select: none;
  -webkit-user-select: none;
}

/* Device frame — desktop card chrome */
.device-frame {
  width: 720px;
  height: 1280px;
  max-width: 100vw;
  max-height: 100vh;
  margin: 0 auto;
  background: var(--background);
  border-radius: 1.5rem; /* rounded-3xl */
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25); /* shadow-xl */
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* Collapse frame on small viewports (actual Pi) */
@media (max-width: 720px), (max-height: 1280px) {
  .device-frame {
    width: 100vw;
    height: 100vh;
    max-width: 100vw;
    max-height: 100vh;
    border-radius: 0;
    box-shadow: none;
  }
}

/* Allow text selection in specific areas if needed later */
.selectable {
  user-select: text;
  -webkit-user-select: text;
}

/* Kiosk buttons need large tap targets */
button {
  min-height: 48px;
  min-width: 48px;
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "style: add device frame styles for desktop card chrome"
```

---

## Task 4: Create `DeviceFrame` component

**Files:**
- Create: `src/components/wizard/DeviceFrame.tsx`

- [ ] **Step 1: Create DeviceFrame component**

```typescript
'use client';

interface DeviceFrameProps {
  children: React.ReactNode;
}

/**
 * Wraps the wizard in a fixed 720×1280 card on desktop,
 * collapses to full-bleed on the actual Pi viewport.
 */
export function DeviceFrame({ children }: DeviceFrameProps) {
  return (
    <div className="device-frame">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/DeviceFrame.tsx
git commit -m "feat: add DeviceFrame component for desktop card chrome"
```

---

## Task 5: Create `StepTitle` component

**Files:**
- Create: `src/components/wizard/StepTitle.tsx`

- [ ] **Step 1: Create StepTitle component**

```typescript
'use client';

interface StepTitleProps {
  it: string;
  en: string;
  descriptionIt?: string;
  descriptionEn?: string;
}

/**
 * Standard title block for wizard steps.
 * Renders Italian title as display heading, English as italic subtitle.
 * Optional bilingual description block, left-aligned.
 */
export function StepTitle({ it, en, descriptionIt, descriptionEn }: StepTitleProps) {
  return (
    <div className="mb-6">
      <h1 className="text-5xl font-black text-black tracking-tight leading-[1.05]">
        {it}
      </h1>
      <p className="text-xl italic text-gray-400 mt-2">
        {en}
      </p>

      {(descriptionIt || descriptionEn) && (
        <>
          <p className="text-base text-gray-500 mt-6">
            {descriptionIt}
            {descriptionIt && descriptionEn && <br />}
            {descriptionEn}
          </p>
          <hr className="border-gray-200 mt-6" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/wizard/StepTitle.tsx
git commit -m "feat: add StepTitle component for consistent step headings"
```

---

## Task 6: Update `QuantityControl`

**Files:**
- Modify: `src/components/wizard/QuantityControl.tsx:9-36`

- [ ] **Step 1: Read current QuantityControl**

```bash
cat src/components/wizard/QuantityControl.tsx
```

- [ ] **Step 2: Replace with larger, primary variant**

```typescript
'use client';

interface QuantityControlProps {
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function QuantityControl({ quantity, onInc, onDec }: QuantityControlProps) {
  const isIncPrimary = quantity > 0;

  return (
    <div className="flex items-center">
      <button
        onClick={onDec}
        disabled={quantity === 0}
        className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-colors ${
          quantity === 0
            ? 'cursor-not-allowed border-gray-200 text-gray-300'
            : 'border-gray-300 text-black active:bg-gray-100'
        }`}
        aria-label="Decrease quantity"
      >
        &minus;
      </button>
      <span className="w-10 text-center text-2xl font-bold tabular-nums text-black">
        {quantity}
      </span>
      <button
        onClick={onInc}
        className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl font-bold transition-colors ${
          isIncPrimary
            ? 'bg-black text-white border-black active:bg-gray-800'
            : 'border-gray-300 text-black active:bg-gray-100'
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/QuantityControl.tsx
git commit -m "feat(qty): larger buttons with primary + variant when active"
```

---

## Task 7: Update `ProductRow`

**Files:**
- Modify: `src/components/wizard/ProductRow.tsx:10-44`

- [ ] **Step 1: Read current ProductRow**

```bash
cat src/components/wizard/ProductRow.tsx
```

- [ ] **Step 2: Replace with heavier typography**

```typescript
'use client';

import type { Product } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { QuantityControl } from '@/components/wizard/QuantityControl';

interface ProductRowProps {
  product: Product;
  quantity: number;
  onInc: () => void;
  onDec: () => void;
}

export function ProductRow({ product, quantity, onInc, onDec }: ProductRowProps) {
  const isFree = product.isFree === true;

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100">
      {/* Labels */}
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-lg font-bold text-black">
          {product.label.it}
        </span>
        <span className="text-sm italic text-gray-400">
          {product.label.en}
        </span>
      </div>

      {/* Price + quantity */}
      {isFree ? (
        <span className="text-sm text-gray-400 italic">
          Gratis / Free of charge
        </span>
      ) : (
        <div className="flex items-center gap-4 shrink-0">
          <span className="text-lg font-bold tabular-nums text-black">
            {formatChf(product.priceCents)}
          </span>
          <QuantityControl quantity={quantity} onInc={onInc} onDec={onDec} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/ProductRow.tsx
git commit -m "feat(product-row): heavier labels, add row borders"
```

---

## Task 8: Update `ProductGroupHeader`

**Files:**
- Modify: `src/components/wizard/ProductGroupHeader.tsx:8-26`

- [ ] **Step 1: Read current ProductGroupHeader**

```bash
cat src/components/wizard/ProductGroupHeader.tsx
```

- [ ] **Step 2: Replace with heavier caps and included note prop**

```typescript
'use client';

import type { Group } from '@/lib/catalog';

interface IncludedNote {
  it: string;
  en: string;
}

interface ProductGroupHeaderProps {
  group: Group;
  includedNote?: IncludedNote;
}

export function ProductGroupHeader({ group, includedNote }: ProductGroupHeaderProps) {
  return (
    <div className="mb-3 mt-10 first:mt-0">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-extrabold tracking-[0.2em] text-black flex items-center gap-2">
          {group.label.it.toUpperCase()}
          {includedNote && (
            <span className="font-normal tracking-normal not-italic text-sm text-gray-600">
              — {includedNote.it}
            </span>
          )}
        </h2>
        <div className="text-right">
          <span className="text-sm text-gray-400">
            {group.label.en}
          </span>
          {includedNote && (
            <div className="text-sm italic text-gray-400">
              {includedNote.en}
            </div>
          )}
        </div>
      </div>
      {group.note && (
        <p className="mt-1 text-xs text-gray-400 italic">
          {group.note.it} / {group.note.en}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/ProductGroupHeader.tsx
git commit -m "feat(group-header): heavier caps, optional included note prop"
```

---

## Task 9: Rewrite `StepHeader` as stepper

**Files:**
- Modify: `src/components/wizard/StepHeader.tsx:1-50`

- [ ] **Step 1: Read current StepHeader**

```bash
cat src/components/wizard/StepHeader.tsx
```

- [ ] **Step 2: Replace with 4-pill stepper**

```typescript
'use client';

import { useWizard } from '@/lib/wizard-context';

const TOTAL_STEPS = 4 as const;

export function StepHeader() {
  const { state, dispatch } = useWizard();
  const { step, phase } = state;

  const isDisabled = phase === 'processing' || phase === 'success' || phase === 'failed';

  function goToStep(targetStep: 1 | 2 | 3 | 4) {
    if (isDisabled) return;
    if (targetStep >= step) return; // Can't jump forward
    dispatch({ type: 'GO_TO_STEP', step: targetStep });
  }

  return (
    <header className="flex items-center justify-center px-5 py-4 gap-3">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = (i + 1) as 1 | 2 | 3 | 4;
        const isActive = step === stepNum;
        const isPast = stepNum < step;

        if (isActive) {
          return (
            <button
              key={stepNum}
              disabled={isDisabled}
              className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase bg-black text-white cursor-default"
            >
              STEP {stepNum}
            </button>
          );
        }

        if (isPast) {
          return (
            <button
              key={stepNum}
              onClick={() => goToStep(stepNum)}
              disabled={isDisabled}
              className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase bg-gray-200 text-black hover:bg-gray-300 active:bg-gray-400 transition-colors"
            >
              STEP {stepNum}
            </button>
          );
        }

        return (
          <button
            key={stepNum}
            disabled
            className="rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase border border-gray-200 text-gray-300 cursor-not-allowed"
          >
            STEP {stepNum}
          </button>
        );
      })}
    </header>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/StepHeader.tsx
git commit -m "feat(header): replace single pill with 4-pill stepper, remove lang toggle"
```

---

## Task 10: Update `StepFooter`

**Files:**
- Modify: `src/components/wizard/StepFooter.tsx:9-53`

- [ ] **Step 1: Read current StepFooter**

```bash
cat src/components/wizard/StepFooter.tsx
```

- [ ] **Step 2: Replace with bilingual continue and larger total**

```typescript
'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';

export function StepFooter() {
  const { state, dispatch } = useWizard();
  const { step, cart } = state;

  const total = cartTotal(cart);
  const isContinueDisabled = step === 1 && total === 0;

  // Bilingual button labels — Italian primary (top), English secondary (below)
  const buttonLabels = {
    1: { it: 'Continua', en: 'Continue' },
    2: { it: 'Continua', en: 'Continue' },
    3: { it: 'Pagamento', en: 'Payment' },
    4: { it: 'Pagamento', en: 'Payment' },
  };

  const currentLabel = buttonLabels[step as keyof typeof buttonLabels];

  function handleContinue() {
    if (isContinueDisabled) return;
    const nextStep = (step + 1) as 1 | 2 | 3 | 4;
    dispatch({ type: 'GO_TO_STEP', step: nextStep });
  }

  return (
    <footer className="sticky bottom-0 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        {/* Running total */}
        <div className="flex flex-col">
          <span className="text-xs font-bold text-black uppercase tracking-wider">
            Totale{' '}
            <span className="italic font-normal text-gray-400">Total</span>
          </span>
          <span className="text-4xl font-black tabular-nums text-black">
            {formatChf(total)}
          </span>
        </div>

        {/* Continue button */}
        <button
          onClick={handleContinue}
          disabled={isContinueDisabled}
          className={`rounded-2xl px-8 py-4 transition-colors flex flex-col items-center ${
            isContinueDisabled
              ? 'cursor-not-allowed bg-gray-100'
              : 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
          }`}
        >
          <span className={`text-xl font-bold ${isContinueDisabled ? 'text-gray-300' : 'text-white'}`}>
            {currentLabel.it}
          </span>
          <span className={`text-sm italic font-medium ${isContinueDisabled ? 'text-gray-400' : 'text-white/90'}`}>
            {currentLabel.en}
          </span>
        </button>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/StepFooter.tsx
git commit -m "feat(footer): bilingual continue button, larger total display"
```

---

## Task 11: Update `WizardChrome` to use DeviceFrame

**Files:**
- Modify: `src/components/wizard/WizardChrome.tsx:1-30`

- [ ] **Step 1: Read current WizardChrome**

```bash
cat src/components/wizard/WizardChrome.tsx
```

- [ ] **Step 2: Wrap wizard in DeviceFrame**

```typescript
'use client';

import { useWizard } from '@/lib/wizard-context';
import { DeviceFrame } from '@/components/wizard/DeviceFrame';
import { StepHeader } from '@/components/wizard/StepHeader';
import { StepFooter } from '@/components/wizard/StepFooter';
import { Step1Tickets } from '@/components/wizard/Step1Tickets';
import { Step2Shoes } from '@/components/wizard/Step2Shoes';
import { Step3Summary } from '@/components/wizard/Step3Summary';
import { Step4Payment } from '@/components/wizard/Step4Payment';
import { IdleWatcher } from '@/components/wizard/IdleWatcher';

export function WizardChrome() {
  const { state } = useWizard();

  return (
    <DeviceFrame>
      <StepHeader />

      <main className="flex-1 overflow-y-auto px-5 py-2">
        {state.step === 1 && <Step1Tickets />}
        {state.step === 2 && <Step2Shoes />}
        {state.step === 3 && <Step3Summary />}
        {(state.step === 4 || state.phase === 'success') && <Step4Payment />}
      </main>

      {state.phase !== 'success' && <StepFooter />}

      <IdleWatcher />
    </DeviceFrame>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/WizardChrome.tsx
git commit -m "refactor(wizard): wrap in DeviceFrame for desktop card chrome"
```

---

## Task 12: Update `Step1Tickets`

**Files:**
- Modify: `src/components/wizard/Step1Tickets.tsx:1-52`

- [ ] **Step 1: Read current Step1Tickets**

```bash
cat src/components/wizard/Step1Tickets.tsx
```

- [ ] **Step 2: Replace to use StepTitle and left-align**

```typescript
'use client';

import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { StepTitle } from '@/components/wizard/StepTitle';
import { ProductGroupHeader } from '@/components/wizard/ProductGroupHeader';
import { ProductRow } from '@/components/wizard/ProductRow';

export function Step1Tickets() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(1);

  return (
    <div>
      <StepTitle
        it="Scegli i biglietti"
        en="Choose your tickets"
        descriptionIt="Puoi acquistare più biglietti contemporaneamente."
        descriptionEn="You can purchase several tickets at once."
      />

      {groups.map((group) => (
        <div key={group.id}>
          <ProductGroupHeader group={group} />
          {group.products.map((product) => {
            const quantity =
              state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

            if (product.isFree) {
              return (
                <ProductRow
                  key={product.id}
                  product={product}
                  quantity={0}
                  onInc={() => {}}
                  onDec={() => {}}
                />
              );
            }

            return (
              <ProductRow
                key={product.id}
                product={product}
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
            );
          })}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/Step1Tickets.tsx
git commit -m "refactor(step1): use StepTitle, remove custom title block"
```

---

## Task 13: Update `Step2Shoes`

**Files:**
- Modify: `src/components/wizard/Step2Shoes.tsx:1-90`

- [ ] **Step 1: Read current Step2Shoes**

```bash
cat src/components/wizard/Step2Shoes.tsx
```

- [ ] **Step 2: Replace with restructured card layout**

```typescript
'use client';

import { useCallback } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { getGroupsForStep } from '@/lib/catalog';
import { formatChf } from '@/lib/money';
import { StepTitle } from '@/components/wizard/StepTitle';
import { QuantityControl } from '@/components/wizard/QuantityControl';

export function Step2Shoes() {
  const { state, dispatch } = useWizard();
  const groups = getGroupsForStep(2);
  const rentalGroup = groups.find((g) => g.layout === 'single-card');
  const product = rentalGroup?.products[0];

  const handleSkip = useCallback(() => {
    if (!product) return;
    const existing = state.cart.find((l) => l.productId === product.id);
    if (existing) {
      dispatch({ type: 'SET', productId: product.id, quantity: 0 });
    }
    dispatch({ type: 'GO_TO_STEP', step: 3 });
  }, [product, state.cart, dispatch]);

  if (!product) return null;

  const quantity =
    state.cart.find((l) => l.productId === product.id)?.quantity ?? 0;

  return (
    <div>
      <StepTitle
        it={state.lang === 'it' ? 'Vuoi noleggiare le scarpette?' : 'Need climbing shoes?'}
        en={state.lang === 'en' ? 'Vuoi noleggiare le scarpette?' : 'Need climbing shoes?'}
        descriptionIt="Aggiungi il numero di paia necessarie."
        descriptionEn="Add the number of pairs you need."
      />

      {/* Single product card */}
      <div className="w-full max-w-sm mx-auto bg-gray-100 rounded-3xl p-6">
        {/* Header */}
        <div className="flex items-baseline justify-between mb-6">
          <h3 className="text-sm font-extrabold tracking-[0.2em] text-black">
            NOLEGGIO
          </h3>
          <span className="text-sm italic text-gray-400">
            Rental
          </span>
        </div>

        {/* Product name */}
        <div className="text-center mb-4">
          <h2 className="text-4xl font-black text-black">
            {product.label.it}
          </h2>
          <p className="text-lg italic text-gray-400 mt-1">
            {product.label.en}
          </p>
        </div>

        {/* Price */}
        <div className="text-center mb-6">
          <p className="text-3xl font-black text-black">
            {formatChf(product.priceCents)}
          </p>
          <p className="text-sm text-gray-500">
            per paio / per pair
          </p>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 mb-6" />

        {/* Quantity selector */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-base font-bold text-black">
              Quanti?
            </p>
            <p className="text-sm italic text-gray-400">
              How many?
            </p>
          </div>
          <QuantityControl
            quantity={quantity}
            onInc={() =>
              dispatch({
                type: 'INC',
                productId: product.id,
                groupId: rentalGroup!.id,
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

      {/* Skip link */}
      <button
        type="button"
        onClick={handleSkip}
        className="mt-6 w-full text-center text-sm text-gray-400 underline decoration-gray-300 transition-colors hover:text-gray-600"
      >
        No grazie, salta questo passo
        <br />
        <span className="text-xs">No thanks, skip this step</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/Step2Shoes.tsx
git commit -m "refactor(step2): restructure card to match reference design"
```

---

## Task 14: Update `Step3Summary`

**Files:**
- Modify: `src/components/wizard/Step3Summary.tsx:1-82`

- [ ] **Step 1: Read current Step3Summary**

```bash
cat src/components/wizard/Step3Summary.tsx
```

- [ ] **Step 2: Replace to use StepTitle and hoisted helper**

```typescript
'use client';

import { useWizard } from '@/lib/wizard-context';
import { cartTotal } from '@/lib/cart';
import { formatChf } from '@/lib/money';
import { hasDailyPass, hasShowerOnly } from '@/lib/cart-rules';
import { StepTitle } from '@/components/wizard/StepTitle';
import type { CartLine } from '@/lib/cart';

export function Step3Summary() {
  const { state } = useWizard();
  const { cart, lang } = state;

  const activeItems = cart.filter((l) => l.quantity > 0);
  const total = cartTotal(cart);
  const showShowerHint = hasDailyPass(cart) && !hasShowerOnly(cart);

  return (
    <div className="flex flex-col gap-4">
      <StepTitle
        it={lang === 'it' ? 'Riepilogo' : 'Summary'}
        en={lang === 'en' ? 'Riepilogo' : 'Summary'}
        descriptionIt="Controlla il tuo ordine prima di procedere."
        descriptionEn="Review your order before proceeding."
      />

      {/* Line items */}
      <div className="rounded-2xl border border-gray-200 divide-y divide-gray-100">
        {activeItems.map((line) => (
          <div
            key={line.productId}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-base font-medium text-black">
              {lang === 'it' ? line.labelIt : line.labelEn}
            </span>
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-gray-400">x{line.quantity}</span>
              <span className="text-base font-bold tabular-nums text-black">
                {formatChf(line.priceCents * line.quantity)}
              </span>
            </div>
          </div>
        ))}

        {/* Grand total */}
        <div className="flex items-center justify-between px-4 py-4 bg-black rounded-b-2xl">
          <span className="text-base font-bold text-white">
            Totale / Total
          </span>
          <span className="text-2xl font-bold tabular-nums text-white">
            {formatChf(total)}
          </span>
        </div>
      </div>

      {/* Shower included hint */}
      {showShowerHint && (
        <div className="rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-500">
            La doccia è inclusa con la giornaliera
            <br />
            <span className="text-gray-400">
              Shower is included with your daily pass
            </span>
          </p>
        </div>
      )}

      {/* Payment notice */}
      <div className="rounded-xl border border-gray-200 px-4 py-3">
        <p className="text-sm text-gray-500">
          Pagamento con TWINT, carta di credito o carta prepagata
          <br />
          <span className="text-gray-400">
            Payment via TWINT, credit card or prepaid card
          </span>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/Step3Summary.tsx
git commit -m "refactor(step3): use StepTitle, hoisted cart rules helper"
```

---

## Task 15: Update `Step4Success` to Italian-only

**Files:**
- Modify: `src/components/wizard/Step4Success.tsx:1-82`

- [ ] **Step 1: Read current Step4Success**

```bash
cat src/components/wizard/Step4Success.tsx
```

- [ ] **Step 2: Replace with Italian-only text**

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWizard } from '@/lib/wizard-context';

const COUNTDOWN_SECONDS = 10;

export function Step4Success() {
  const { state, dispatch } = useWizard();
  const { payment } = state;
  const [remaining, setRemaining] = useState(COUNTDOWN_SECONDS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetSession = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    dispatch({ type: 'RESET_SESSION' });
  }, [dispatch]);

  // Countdown timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          // Timer expired — reset session
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Use a microtask to avoid dispatch during render
          queueMicrotask(() => dispatch({ type: 'RESET_SESSION' }));
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [dispatch]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 px-6 py-10">
      {/* Checkmark icon */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-12 w-12 text-green-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 12.75l6 6 9-13.5"
          />
        </svg>
      </div>

      {/* Heading */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          Pagamento riuscito!
        </h2>
        <p className="mt-1 text-base text-gray-600">
          Grazie e buona arrampicata!
        </p>
      </div>

      {/* Transaction ID */}
      {payment.transactionId && (
        <p className="text-sm text-gray-500">
          ID transazione: {payment.transactionId}
        </p>
      )}

      {/* Restart button */}
      <button
        onClick={resetSession}
        className="rounded-xl bg-black px-8 py-3 text-base font-bold text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
      >
        Nuova sessione
      </button>

      {/* Countdown hint */}
      <p className="text-xs text-gray-400">
        Ripartimento automatico tra {remaining} secondi
      </p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/wizard/Step4Success.tsx
git commit -m "refactor(success): switch to Italian-only text"
```

---

## Task 16: Visual verification checklist

**Files:**
- None (manual verification)

- [ ] **Step 1: Start dev server**

```bash
cd /home/francesco/workdir/kletterhalle-kiosk
npm run dev
```

Expected output: Server starts on http://localhost:3000

- [ ] **Step 2: Open Chrome DevTools, set device to 720×1280 portrait**

1. Open http://localhost:3000
2. Press F12, click device toolbar icon
3. Select "Responsive" and set 720×1280
4. Rotate to portrait if needed

- [ ] **Step 3: Verify Step 1 tickets page**

Check:
- [ ] Title "Scegli i biglietti" is display-size, black font-weight
- [ ] Subtitle "Choose your tickets" is italic gray below
- [ ] Description "Puoi acquistare..." is left-aligned, not centered
- [ ] All 4 stepper pills visible at top, step 1 is black
- [ ] Product labels are heavy (bold), English subtitles italic gray
- [ ] Prices show without trailing .00 (e.g., "CHF 16" not "CHF 16.00")
- [ ] + button turns black after clicking it once

- [ ] **Step 4: Verify Step 2 shoes page**

Check:
- [ ] Card has gray background, rounded corners
- [ ] "NOLEGGIO" / "Rental" header at top of card
- [ ] "Scarpette" / "Climbing shoes" is large, centered
- [ ] Price is large and bold
- [ ] "Quanti? / How many?" left-aligned, quantity control right-aligned
- [ ] Skip link below card, bilingual

- [ ] **Step 5: Verify Step 3 summary page**

Check:
- [ ] Title left-aligned
- [ ] Line items list correct
- [ ] Total "Totale / Total" and amount in black footer
- [ ] Shower hint shows when daily pass in cart

- [ ] **Step 6: Verify stepper navigation**

Check:
- [ ] On step 2, click step 1 pill → navigates back
- [ ] On step 3, click step 1 or 2 pill → navigates back
- [ ] Step 4 pill is never clickable on steps 1-3
- [ ] Click continue through to step 4, verify no past pills are clickable during payment

- [ ] **Step 7: Verify desktop card chrome**

Check:
- [ ] Open browser at 1440×900 (desktop size)
- [ ] Wizard is centered on page, gray margins visible
- [ ] Card has rounded corners and shadow
- [ ] Card is exactly 720px wide (measure with DevTools)

- [ ] **Step 8: Verify Pi viewport (max-width 720px)**

Check:
- [ ] Resize browser to 720px width
- [ ] Gray margins disappear, card goes full-bleed
- [ ] No horizontal scroll

- [ ] **Step 9: Verify footer**

Check:
- [ ] "Totale Total" with "Totale" bold, "Total" italic gray inline
- [ ] Total amount is large (text-4xl)
- [ ] Continue button stacks "Continua" over "Continue"

- [ ] **Step 10: Test payment flow and Italian receipt**

Check:
- [ ] Complete a purchase flow
- [ ] After payment, success screen shows Italian only: "Pagamento riuscito!", "Grazie e buona arrampicata!", "Nuova sessione"
- [ ] No English text on success screen

---

## Task 17: Final cleanup commit

**Files:**
- None (documentation)

- [ ] **Step 1: Verify no TypeScript errors**

```bash
npm run build
```

Expected: Clean build, no type errors

- [ ] **Step 2: Verify no ESLint errors**

```bash
npm run lint
```

Expected: No lint errors (or only pre-existing ones)

- [ ] **Step 3: Amend spec with implementation timestamp**

```bash
echo "" >> docs/superpowers/specs/2026-05-25-kiosk-ui-iteration-design.md
echo "## Implementation" >> docs/superpowers/specs/2026-05-25-kiosk-ui-iteration-design.md
echo "Implemented: 2026-05-25" >> docs/superpowers/specs/2026-05-25-kiosk-ui-iteration-design.md
git add docs/superpowers/specs/2026-05-25-kiosk-ui-iteration-design.md
git commit --amend --no-edit
```

- [ ] **Step 4: Squash all implementation commits (optional)**

```bash
git rebase -i HEAD~16
# Replace 'pick' with 'squash' for all but the first commit
# Save with a unified message: "feat: kiosk UI iteration — stepper, typography, card chrome"
```

---

**Plan complete.** Follow the tasks sequentially. Each task commits independently for easy rollback if needed.
