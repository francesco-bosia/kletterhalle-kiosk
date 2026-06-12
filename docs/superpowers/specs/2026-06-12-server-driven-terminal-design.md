# Server-Driven Stripe Terminal (Card Payments) — Design

**Date:** 2026-06-12
**Status:** Approved design (pending implementation plan)
**Supersedes:** the client-side Terminal JS SDK integration
(`terminal-provider.tsx` + connection tokens). Builds on the approved
2026-06-12 payment-fulfillment design (server-side fulfillment + reconcile
sweep), which is unchanged by this work.

## Problem

The Terminal JS SDK requires the kiosk browser to reach the WisePOS E over
the local network. That path failed in the field ("could not communicate
with reader") and is structurally fragile on networks we don't control:

- Router DNS rebind protection blocks the SDK's
  `*.device.stripe-terminal-local-reader.net` hostnames (hit at the gym;
  worked around with an `/etc/hosts` hack).
- Modern browsers gate pages' local-network access behind permissions
  (Firefox `LocalNetworkAccess`, Chrome 142+ LNA) that are invisible in
  kiosk mode and change under us.
- Same-LAN + local-DNS + stable-DHCP requirements (Stripe Terminal
  deployment checklist) must all hold at a venue where we have no router
  access.

## Decision: server-driven Terminal

The Pi's Next.js server drives the reader through Stripe's API
(`POST /v1/terminal/readers/{tmr}/process_payment_intent`). Stripe's cloud
pushes the action to the reader over the internet. Kiosk browser and reader
never communicate; the reader only needs internet access.

**Result notification — polling, not webhooks (deliberate deviation):**
Stripe's checklist says server-driven integrations receive action results
via `terminal.reader.action_succeeded|failed` webhooks. The Pi sits behind
NAT and cannot receive webhooks (same constraint chain as the fulfillment
design — see that spec's "Architecture decision: the Pi polls Stripe").
Verified against docs.stripe.com/terminal/payments/collect-card-payment
(server-driven): polling the Reader object's `action.status` and the
PaymentIntent is a documented alternative. At kiosk volume (one read/second
only while a payment is in flight) rate limits are irrelevant.

**Verified API behavior the design relies on** (collect-card-payment,
server-driven variant, fetched 2026-06-12):

- `capture_method: automatic` is supported; PI ends `succeeded` with no
  separate capture call → the existing fulfillment gate
  (`pi.status === 'succeeded'`) keeps working unchanged.
- Declined card: PI **returns to `requires_payment_method`** (same status
  as "not yet tapped") and the reader action reports
  `failed` + `action.api_error` / `failure_code`. Decline detection must
  therefore read the **reader action**, not the PI. Retry = re-process the
  **same PI** (Stripe explicitly: do not create a new PI on decline).
- `cancel_action` cannot interrupt an authorization in progress
  (`terminal_reader_busy`); wait for completion instead.
- Test mode: a **simulated reader** can be driven server-side and the tap
  simulated with
  `POST /v1/test_helpers/terminal/readers/{tmr}/present_payment_method` —
  full E2E from the dev machine, no hardware, no LAN.

## Phase 0 (precursor): Stripe upgrade

Before the migration, upgrade the Stripe SDK and pinned API version
(`2026-01-28.clover` → latest, `2026-03-25.dahlia` per skill) as its own
commit, using the `upgrade-stripe` skill. Run the full test suite before
starting the Terminal work so migration diffs sit on a current baseline.

## API surface (three thin routes)

State-decision logic lives in `src/lib/terminal-payment.ts` behind a
narrow, SDK-free Stripe interface (same pattern as `fulfillment.ts`);
routes stay thin and pass `getStripe()` in.

### `POST /api/terminal/pay` — body `{ paymentIntentId }`

Calls `stripe.terminal.readers.processPaymentIntent(READER_ID, {
payment_intent, process_config: { enable_customer_cancellation: true } })`.
Also the **retry** path after a decline (same PI). Error mapping (no raw
Stripe errors in responses):

| Stripe failure                  | Response                              |
| ------------------------------- | ------------------------------------- |
| reader offline                  | 503 `{ error: 'reader-offline' }`     |
| `terminal_reader_busy`          | 409 `{ error: 'reader-busy' }`        |
| PI not processable (canceled…)  | 409 `{ error: 'payment-not-payable' }`|
| anything else                   | 500 `{ error: 'terminal-error' }`     |

### `GET /api/terminal/state[?paymentIntentId=…]` — the 1 Hz poll target

Without `paymentIntentId`: retrieve reader → `{ readerOnline: boolean }`
(used by the card screen's status indicator, polled every 10s).

With `paymentIntentId`: retrieve reader first.

- Reader action targets this PI and is `in_progress` → `{ state: 'waiting' }`
- Reader action targets this PI and is `failed` →
  `{ state: 'declined', message }` (from `action.api_error.decline_code` /
  `failure_code`, mapped to i18n keys, not raw API text)
- Otherwise retrieve the PI:
  - `succeeded` → fire-and-forget `fulfillPaymentIntent()` (idempotent,
    mutexed, sweep-backstopped) → `{ state: 'succeeded' }`
  - `canceled` → `{ state: 'canceled' }`
  - else → `{ state: 'waiting' }`

### `POST /api/terminal/cancel` — body `{ paymentIntentId }`

1. `cancel_action` on the reader.
   - `terminal_reader_busy` → `{ busy: true }`; client keeps polling
     through a ≤10s grace window (customer tapped at the buzzer — if the
     charge lands, show success, not cancellation).
2. Cancel the PI.
   - Fails because already `succeeded` → `{ state: 'succeeded' }`; UI
     flips to success.
   - Otherwise → `{ state: 'canceled' }`.

## Client flow (Step4Payment)

`TerminalProvider` / `useTerminal` deleted (and unmounted wherever it is
mounted). Card flow becomes:

1. Card screen: poll `GET /api/terminal/state` every 10s; Start button
   disabled with a "reader unavailable" message while `readerOnline` is
   false (TWINT stays available).
2. Start → create PI (existing `/api/payments/create`, unchanged) →
   `POST /api/terminal/pay`.
3. "Tap your card" screen: **Cancel button + 30s countdown**; poll
   `GET /api/terminal/state?paymentIntentId=…` every 1s.
4. Outcomes:
   - `succeeded` → existing success screen. The client **no longer calls
     `/api/fulfill`** (the state route fulfills server-side). Its only
     caller was this card path — TWINT's fast-path is the `/success` page
     server-side — so `POST /api/fulfill` is deleted too.
     `/api/fulfill/reconcile` (ops) stays.
   - `declined` → failed screen; Retry re-pushes the **same PI** via
     `/api/terminal/pay`; if that returns `payment-not-payable`, fall back
     to creating a fresh PI.
   - 30s elapsed or Cancel pressed → `POST /api/terminal/cancel`; on
     `busy: true` keep polling ≤10s grace; on `canceled` return to the
     payment-method picker.
5. New i18n keys (it/en): reader-unavailable, tap-prompt countdown, cancel,
   declined (+ a few decline-code variants), canceled.

TWINT path untouched.

## Config, deletions, docs

**Env:**
- Add `STRIPE_TERMINAL_READER_ID=tmr_…` (server-only; the kiosk's reader).
- Remove `NEXT_PUBLIC_TERMINAL_SIMULATED`, `NEXT_PUBLIC_TERMINAL_LOCATION_ID`
  everywhere (env example, `build:kiosk` script — which keeps only
  `NEXT_PUBLIC_BASE_URL` — and docs).
- `STRIPE_TERMINAL_LOCATION_ID` no longer read by code; demote to a
  comment in the env example (registration still happens per-location in
  the Dashboard).

**Deleted code:** `src/components/terminal-provider.tsx`,
`src/app/api/terminal/connection-token/`, `src/app/api/terminal/process/`,
`src/app/api/fulfill/route.ts` (orphaned; `/api/fulfill/reconcile` stays),
`@stripe/terminal-js` dependency. Also remove the unused, rk-incompatible
`isTestMode` in `src/lib/stripe.ts`.

**RAK permissions (least privilege):**

| Key       | Permissions                                                                 |
| --------- | --------------------------------------------------------------------------- |
| live RAK  | `terminal.readers.write`, `payment_intents.write`, `checkout_sessions.write` |
| test RAK  | the above + test-helpers (for `present_payment_method`)                      |

`terminal.connection_tokens.write` is dropped. Optional hardening: if the
gym has a static public IP, add it as an IP allowlist on the live RAK.

**Docs:** rewrite reader sections in `RASPBERRY-PI-SETUP.md`, `HARDWARE.md`,
`LAPTOP-TESTING.md`: reader requirement becomes "internet access" (drop
same-LAN / local-DNS / browser-permission sections, with a short note on
the server-driven rationale). Document manual Pi cleanup: remove the
`/etc/hosts` line for `192-168-1-162.device.stripe-terminal-local-reader.net`
and `/etc/firefox/policies/policies.json` if created. Update the env
example's RAK permission list and production checklist.

## Error handling summary

| Failure                          | Behavior                                                        |
| -------------------------------- | --------------------------------------------------------------- |
| Reader offline at start          | Start disabled + message; TWINT available                       |
| Decline                          | Failed screen → Retry re-processes same PI                      |
| Customer walks away              | 30s auto-cancel (cancel_action + PI cancel)                     |
| Tap at the buzzer (cancel busy)  | ≤10s grace polling; success wins over cancellation              |
| App crash mid-payment            | Reconcile sweep fulfills any paid PI (unchanged; plan verifies sweep covers card PIs) |
| Printer failure after success    | Unchanged: fulfillment claim released, sweep retries            |

## Testing

- **Unit (vitest, existing mocked-client pattern):** `terminal-payment.ts`
  state mapping (waiting / declined / succeeded / canceled; decline read
  from reader action, not PI), fulfill triggered exactly on succeeded,
  cancel busy-path and already-succeeded path, pay-route error mapping.
- **E2E in test mode from the dev machine:** simulated reader at the test
  location (`tml_GXxBaAe9LCuEk1`), driven by `present_payment_method` test
  helper; full kiosk flow incl. decline + retry + cancel.
- **Live smoke on the Pi:** one real tap + Dashboard refund; confirm
  receipt prints and the transaction log entry.

## Out of scope

- TWINT flow, fulfillment engine, reconcile sweep (unchanged).
- Webhook/tunnel infrastructure (rejected in the fulfillment design).
- Multi-reader support (single `STRIPE_TERMINAL_READER_ID`; revisit if a
  second reader appears).
