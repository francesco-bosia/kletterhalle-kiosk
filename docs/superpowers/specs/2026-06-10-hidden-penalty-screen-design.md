# Hidden Penalty Screen — Design

**Date:** 2026-06-10
**Status:** Approved

## Purpose

Provide a hidden screen for selling a **penalty (Penale)** ticket — a CHF 100 surcharge
charged when someone is caught in the hall without a valid ticket. The screen is not
part of the normal customer flow; an operator reaches it through a secret tap gesture.

## Requirements

- Hidden screen offering a single **Penale** product at **CHF 100**.
- Reached by tapping **5 times** on the Step-1 title "Scegli i biglietti", with **less
  than 1 second between consecutive taps** (the counter resets if a tap comes too late).
- Same visual design as the shoe rental screen (single-card layout).
- The catalog JSON gains a notion of **hidden products**, currently containing only the
  penalty.
- Entering the screen starts an **isolated transaction**: any existing cart is cleared.
- After choosing the quantity and tapping Continua, flow proceeds **through the normal
  summary → payment** steps.
- App chrome (including the 4-pill step header) stays exactly as in the normal pricing
  screens. The single "STEP 2/4" pill in the mockup is illustrative only.

## Catalog — hidden products

Add a top-level `hidden` section to `catalog.json`, separate from `groups` so hidden
products can never leak into the normal steps:

```jsonc
"hidden": {
  "groups": [
    {
      "id": "penalty",
      "layout": "single-card",
      "label": { "it": "Penale", "en": "Surcharge" },
      "products": [
        { "id": "penalty",
          "label": { "it": "Penale", "en": "Penalty" },
          "priceCents": 10000 }
      ]
    }
  ]
}
```

`catalog.ts`:
- Extend the `Catalog` type with an optional `hidden: { groups: Group[] }`.
- `validateCatalog` gains a branch validating `hidden.groups` with the same per-group /
  per-product rules used for `groups` (hidden groups have **no `step` field** — relax that
  check for hidden groups).
- New helper `getHiddenGroup(id: string): Group | undefined`.
- Existing `groups`, `getGroupsForStep`, and `getProductById` remain unchanged (the latter
  scans only the visible `groups`).

## State — penalty view

Add one field to `WizardState`:

```ts
view: 'normal' | 'penalty'  // default 'normal'
```

Two new actions in `WizardAction` / `wizardReducer`:
- `ENTER_PENALTY` — clears the cart, sets `view: 'penalty'`, `step: 1`.
- `EXIT_PENALTY` — clears the penalty cart line, sets `view: 'normal'` (the "In dietro" link).

`RESET_SESSION` already returns `createInitialState()`, so the idle reset clears the view
for free.

## Rendering

- **`WizardChrome`**: when `view === 'penalty'`, `step === 1`, and `phase !== 'success'`,
  render `<PenaltyScreen />` in place of `<Step1Tickets />`. Once the operator continues
  (`GO_TO_STEP 3`), the normal `Step3Summary` / `Step4Payment` render because those are
  driven by `step` and the cart.
- **`PenaltyScreen.tsx`** (new): a copy of `Step2Shoes`'s single-card markup —
  - Title: "Accesso senza titolo valido" / "Access without a valid pass".
  - Card header: "PENALE" / "Surcharge".
  - Product name + `CHF 100` (no per-unit subtitle).
  - `QuantityControl` bound to the `penalty` product / `penalty` group.
  - "In dietro / Back" link → dispatches `EXIT_PENALTY`.
  - The standard footer's Continua advances to step 3 (summary).

## Secret gesture

A small `useSecretTap({ count: 5, maxGapMs: 1000, onActivate })` hook:
- Tracks the timestamp of the last tap; on each tap, if the gap since the previous tap
  exceeds `maxGapMs`, the run resets to 1, otherwise the count increments.
- On reaching `count`, calls `onActivate` and resets.

`StepTitle` gains an optional `onSecretActivate?: () => void`. When provided, the title
heading wires the tap handler. Only `Step1Tickets` passes it (dispatching `ENTER_PENALTY`),
so the gesture is scoped to the Step-1 title and no other screen.

`Date.now()` is used for tap timing inside the hook (client-only, fine here).

## Flow & reuse

The penalty is just a cart line, so summary, payment, Stripe metadata, the printed receipt,
and the transaction log all work unchanged. No changes to the payment/print/log pipeline.

## Testing

- **Catalog**: validator accepts a well-formed `hidden` section and rejects malformed ones;
  `getHiddenGroup('penalty')` returns the group; `getGroupsForStep` still ignores it.
- **Reducer**: `ENTER_PENALTY` clears the cart and sets `view: 'penalty'`; `EXIT_PENALTY`
  clears the penalty line and restores `view: 'normal'`; `RESET_SESSION` clears the view.
- **Tap hook**: 5 taps within the window fire `onActivate`; a tap arriving after >1s resets
  the count so it does not fire.

## Out of scope

- Authentication / PIN protection for the screen (gesture is the only gate).
- Configurable penalty amount via UI (it lives in `catalog.json`).
- Multiple hidden products (structure supports it, but only the penalty exists now).
