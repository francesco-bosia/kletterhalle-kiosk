# Shoe-only sessions — design

**Date:** 2026-06-12
**Status:** Approved (pending spec review)

## Problem

The kiosk wizard runs Tickets (step 1) → Shoes (step 2) → Summary (step 3) →
Payment (step 4). The empty-cart guard lives in `StepFooter.tsx`: on step 1 the
Continue button is disabled while `total === 0`. This means a customer cannot
reach the Shoes step without first adding a ticket.

That blocks a real case: a customer who already holds a season ticket and only
wants to rent shoes. They have nothing to add on the Tickets step, so they can
never advance.

## Goal

Let an empty cart pass through the Tickets step and reach Shoes, while still
preventing a truly empty session from reaching payment. Add a small hint on the
Tickets step so season-ticket holders know they can skip ahead.

## Scope

In scope:
- Move the empty-cart guard from Tickets (step 1) to Shoes (step 2).
- Add an informational, bilingual hint on the Tickets step.

Out of scope:
- Season-ticket verification. The kiosk performs no ticket verification today
  and this change adds none — it is purely a navigation affordance.
- Any reducer/action changes or `StepHeader` changes.

## Design

### 1. Relocate the guard into a testable helper

The guard is currently an inline expression in `StepFooter.tsx`:

```ts
const isContinueDisabled = (step === 1 && total === 0) || (view === 'penalty' && total === 0);
```

Extract it into a pure helper in `src/lib/wizard.ts`, matching this repo's
convention of testing pure logic in `lib/`, and have `StepFooter` call it:

```ts
// src/lib/wizard.ts
export function isContinueDisabled(
  view: WizardState['view'],
  step: number,
  total: number,
): boolean {
  if (view === 'penalty') return total === 0; // unchanged
  return step === 2 && total === 0;            // was: step === 1
}
```

Resulting behavior:

- **Step 1 (Tickets), normal view:** Continue always enabled. An empty cart can
  advance to Shoes.
- **Step 2 (Shoes), normal view:** Continue disabled when `total === 0`. A
  session cannot reach the Summary empty-handed.
- **Steps 3–4:** unchanged. The Summary step (`Step3Summary.tsx`) is read-only —
  it renders line items with no quantity controls — so the cart cannot be
  emptied after Shoes. Guarding step 2 is therefore sufficient.
- **Penalty view:** unchanged. The penalty branch still disables Continue while
  `total === 0` (penalty view sits at step 1 with a single penalty line).

`StepFooter.tsx` imports the helper and replaces its inline expression with a
call. The local variable is renamed to avoid colliding with the imported name:

```ts
import { LAST_SHOPPING_STEP, isContinueDisabled } from '@/lib/wizard';
// ...
const continueDisabled = isContinueDisabled(view, step, total);
```

All `isContinueDisabled` references in the JSX (button `disabled` and the
conditional class names) are updated to `continueDisabled`.

### 2. Hint on the Tickets step

`Step1Tickets.tsx` passes `descriptionIt` / `descriptionEn` into the existing
`StepTitle` component, which already renders a bilingual description block
followed by a divider. No new component is introduced.

- **IT:** "Hai un abbonamento? Premi «Continua» per andare alle scarpette."
- **EN:** "Have a season ticket? Tap 'Continue' to go to shoes."

The hint is purely informational; the always-enabled Continue button on step 1
performs the navigation.

## Testing

Add unit tests for `isContinueDisabled` in `src/lib/wizard.test.ts`:

- normal view, step 1, `total === 0` → not disabled (the new behavior).
- normal view, step 2, `total === 0` → disabled.
- normal view, step 2, `total > 0` → not disabled.
- penalty view, `total === 0` → disabled.
- penalty view, `total > 0` → not disabled.

This is the primary behavioral safeguard for the change and fits the existing
pure-logic test pattern in `wizard.test.ts`.

## Files touched

- `src/lib/wizard.ts` — add `isContinueDisabled` helper.
- `src/components/wizard/StepFooter.tsx` — call the helper instead of the inline
  expression.
- `src/components/wizard/Step1Tickets.tsx` — pass the hint into `StepTitle`.
- `src/lib/wizard.test.ts` — add helper tests.
