# Kiosk UI Iteration — Design

**Date:** 2026-05-25
**Status:** Approved (pending spec review)
**Target device:** Raspberry Pi Official Touch Display 2 — 720 × 1280 px, portrait

## Problem

The current wizard UI in `src/components/wizard/` does not match the agreed mockups. Specifically:

1. On a wide desktop browser the wizard fills the full viewport with no margins and no card framing, making preview/review difficult.
2. Title and label typography is too small and too light vs. the reference (`~/cc-shared/Reference_mobile_step*.png`).
3. The IT/EN language toggle in `StepHeader` is redundant: every page already renders both languages inline.
4. Step titles in Step 1 / Step 3 are left-aligned, Step 2 is centered — inconsistent and against the reference (all left-aligned).
5. There is no overview of progress: the current header shows only the active step pill, which doubles as a single-step back button. We want a 4-pill stepper.
6. Several small visual issues: `formatChf` always shows `.00`; `QuantityControl` is too small and never turns the `+` button black on active state; the Step 2 product card lacks the card structure shown in the reference; the footer "Continue" button is not bilingual.
7. The receipt/success screen is bilingual; per requirement it should be Italian-only.

## Goals

- Match the reference mockups for Step 1, Step 2, and Step 3.
- Display the wizard as a fixed 720×1280 centered card on desktop preview; full-bleed on the Pi.
- Add a 4-pill stepper at the top, with the current step black and past steps clickable to navigate back.
- Make the receipt/success screen Italian-only.
- Extract reusable primitives so future steps inherit the typography and the desktop frame for free.

## Non-Goals

- No changes to catalog data, cart logic, payment flow (`Step4Payment`), terminal provider, or i18n utility itself. The `t()` helper stays in place; we just stop calling it for the visible strings that this spec replaces with inline bilingual text.
- No new design tokens / Tailwind theme extension.
- The idle modal keeps its current bilingual treatment.
- The printed receipt / PDF output is out of scope.

## Architecture

Two new shared primitives plus targeted edits to existing components.

```
DeviceFrame
└── WizardChrome
    ├── StepHeader (rewritten as 4-pill stepper)
    ├── <main>
    │   ├── Step1Tickets
    │   │   ├── StepTitle (new)
    │   │   ├── ProductGroupHeader (heavier caps)
    │   │   └── ProductRow (heavier labels)
    │   │       └── QuantityControl (larger, primary +)
    │   ├── Step2Shoes (restructured card)
    │   │   ├── StepTitle (new)
    │   │   └── QuantityControl
    │   ├── Step3Summary
    │   │   └── StepTitle (new)
    │   └── Step4Payment / Step4Success (Italian-only)
    └── StepFooter (bilingual Continua/Continue button, larger total)
```

### 1. `DeviceFrame` (new) — `src/components/wizard/DeviceFrame.tsx`

A pure layout wrapper around the wizard.

- Renders a child container fixed at `720px × 1280px`, `overflow-hidden`, `rounded-3xl`, with `shadow-xl` on a `bg-zinc-100` page background.
- On viewports ≤ 720px wide OR ≤ 1280px tall (the actual Pi), the frame collapses to `w-screen h-screen` with no radius / shadow / outer background.
- Implemented with Tailwind responsive utilities — no JS layout calculation. `html, body { background: var(--frame-bg); overflow: hidden }` in `globals.css`; the frame becomes the scroll boundary.

### 2. `StepTitle` (new) — `src/components/wizard/StepTitle.tsx`

The shared title block, left-aligned, used at the top of Step 1 / Step 2 / Step 3.

```tsx
interface StepTitleProps {
  it: string;          // Italian title
  en: string;          // English subtitle (italic gray)
  descriptionIt?: string;
  descriptionEn?: string;
}
```

Renders:
- `<h1>` Italian title: `text-5xl font-black text-black tracking-tight leading-[1.05]`.
- `<p>` English subtitle: `text-xl italic text-gray-400 mt-2`.
- Description block (if provided): IT on top + EN below, both `text-base text-gray-500`, **left-aligned**, `mt-6`.
- Bottom separator: `<hr class="border-gray-200 mt-6">`.

No `t()` calls — both languages are passed in as props directly by the caller.

### 3. `StepHeader` (rewritten) — `src/components/wizard/StepHeader.tsx`

Replaces the single-pill header with a 4-pill stepper.

- Renders 4 pills horizontally with even spacing: "STEP 1", "STEP 2", "STEP 3", "STEP 4".
- Each pill is `rounded-full px-4 py-2 text-xs font-bold tracking-[0.15em] uppercase`.
- **Active step** (`step === current`): `bg-black text-white`.
- **Past steps** (`step < current`): `bg-gray-200 text-black hover:bg-gray-300 active:bg-gray-400`, clickable → dispatches `GO_TO_STEP`.
- **Future steps** (`step > current`): `border border-gray-200 text-gray-300 cursor-not-allowed`, not clickable.
- During payment (`state.phase === 'processing' | 'success' | 'failed'`) all pills are disabled.
- IT/EN toggle is removed entirely. No `SET_LANG` dispatch from this component.

### 4. `StepFooter` (modified)

- Total label "Totale Total": `Totale` bold + `Total` italic gray inline (small), per reference.
- Total amount: `text-4xl font-black tabular-nums`.
- Continue button: stack of `<span>` lines — `Continua` (`text-xl font-bold`) on top, `Continue` (`text-sm italic font-medium`) below; button keeps current black/disabled-gray treatment; padding bumped to `px-8 py-4 rounded-2xl`.
- On step 3, label becomes `Pagamento` / `Payment` (same stacked structure).

### 5. `Step1Tickets` (modified)

Uses `StepTitle` with:
- it: `Scegli i biglietti`
- en: `Choose your tickets`
- descriptionIt: `Puoi acquistare più biglietti contemporaneamente.`
- descriptionEn: `You can purchase several tickets at once.`

Group iteration unchanged; the group-header / product-row visuals are updated in their own components.

### 6. `Step2Shoes` (restructured)

Top of the screen uses `StepTitle` (left-aligned). The product card below mirrors the reference structure:

```
┌─────────────────────────────────────┐
│ NOLEGGIO                    Rental  │  ← caps tracked / italic gray right
│                                     │
│ Scarpette                           │  ← text-4xl font-black
│ Climbing shoes                      │  ← italic gray
│                                     │
│ CHF 6                               │  ← text-3xl font-black
│ per paio / per pair                 │  ← small gray
│ ─────────────────────────────────── │
│ Quanti?              [−] 2 [+]      │
│ How many?                           │
└─────────────────────────────────────┘
```

Card classes: `bg-gray-100 rounded-3xl p-6`. The "skip this step" link stays below.

### 7. `Step3Summary` (modified)

Uses `StepTitle` (left-aligned). Line items + grand-total card unchanged in structure; minor type tweaks to align with the rest of the design (h1 size, description alignment).

### 8. `Step4Success` (Italian-only)

Single language. Drops all `t()` calls and `lang` reads:
- Heading: `Pagamento riuscito!`
- Subtitle: `Grazie e buona arrampicata!`
- Button: `Nuova sessione`

The countdown timer and existing `RESET_SESSION` dispatch logic are unchanged.

### 9. `ProductRow` (modified)

- Italian label: `text-lg font-bold text-black`.
- English label: `text-sm italic text-gray-400`.
- Price: `text-lg font-bold tabular-nums`.
- Row padding bumped to `py-4`.
- Subtle `border-b border-gray-100` between rows.

### 10. `ProductGroupHeader` (modified)

- Italian caps: `text-sm font-extrabold tracking-[0.2em]`.
- English right-side: italic gray (unchanged style, ensure `text-sm`).
- Top margin between groups bumped (`mt-10`).
- New prop `includedNote?: { it: string; en: string }`. When provided, renders inline next to the Italian caps as `— <it>` plus the English translation on the same row right-aligned beneath. The caller (Step1Tickets) decides whether to pass this prop, driven by a small `src/lib/cart-rules.ts` helper that exports `hasDailyPass(cart)` — currently defined locally inside `Step3Summary.tsx`. This hoist is justified because Step 1 (group header) and Step 3 (the "shower included" hint card) both need the predicate; no other reason. (Note: the wavy red underlines visible in the reference image under "inclusa" and "giornaliera" are spell-check artifacts from the design tool — not strikethrough; we do not implement them.)

### 11. `QuantityControl` (modified)

- Buttons: `h-12 w-12 rounded-xl`.
- `+` variant primary when `quantity > 0`: `bg-black text-white`; outlined `border-gray-300 text-black` when `quantity === 0`.
- `−`: outlined; disabled state `border-gray-200 text-gray-300 cursor-not-allowed`.
- Number: `text-2xl font-bold tabular-nums w-10 text-center`.

### 12. `formatChf` (modified) — `src/lib/money.ts`

```ts
export function formatChf(cents: number): string {
  const whole = cents % 100 === 0;
  return whole ? `CHF ${cents / 100}` : `CHF ${(cents / 100).toFixed(2)}`;
}
```

Behavior:
- `1600 → "CHF 16"`
- `1650 → "CHF 16.50"`
- `0    → "CHF 0"`

### 13. `globals.css` (modified)

- `html, body { background: #f4f4f5 /* zinc-100 */; }`
- Remove `body { background: var(--background) }`; the wizard card supplies its own white background.
- Keep the existing `overflow: hidden` on `html, body`; the device frame becomes the scroll boundary.
- Add a `.device-frame` selector for the desktop card chrome to keep media queries in CSS, away from React.

## Data Flow

No reducer changes. The stepper uses the existing `GO_TO_STEP` action; `SET_LANG` stops being called (the reducer still supports it; we just no longer dispatch from removed UI).

`cart-rules.ts` is a pure helper module — no side effects, no React dependency.

## Error Handling

No new error paths. The stepper's "click past step" path uses the same `GO_TO_STEP` action that `StepHeader`'s back button already used, so no new failure modes.

## Testing

- Visual verification against `~/cc-shared/Reference_mobile_step*.png` after each step is rebuilt.
- Manual smoke test: run dev server, click through Step 1 → 2 → 3 → confirm stepper highlights advance, click past pill → confirm navigation back, confirm future pills are not clickable.
- Confirm at 720×1280 viewport (Chrome dev tools device emulation) the layout matches the reference 1:1.
- Confirm desktop viewport (1440 wide) shows the wizard as a centered card with `bg-zinc-100` margins around it.
- No new unit tests are added — the changes are visual / structural. Existing tests (if any) continue to pass.

## Migration / Rollout

Single PR. No data migration. The `t()` helper and `lang` state remain in place for future expansion, even though several components stop reading from them.

## Out of Scope (Explicit)

- Step 4 Payment-choice screen — not retouched. Only the post-success sub-screen becomes Italian-only.
- Idle modal — keeps bilingual treatment.
- Receipt PDF / printed output — not touched.
- Catalog data, prices, payment flow, terminal logic.
- A new design token system.
