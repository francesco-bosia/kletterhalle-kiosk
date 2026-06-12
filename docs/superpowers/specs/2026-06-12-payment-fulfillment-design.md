# Server-Side Payment Fulfillment (Card + TWINT) — Design

**Date:** 2026-06-12
**Status:** Approved design (pending implementation plan)
**Roadmap items:** P0 #2 (TWINT server-side fulfillment) + absorbs P0 #3 for both
methods (reconciliation against Stripe)

## Problem

A paid customer can fail to receive a ticket, with no recovery path:

- **TWINT:** fulfillment (print + log) depends on the browser returning from
  Stripe Checkout and replaying a localStorage stash
  (`completion-client.ts`, `WizardRoot.tsx`). If the customer walks away,
  closes the tab, or connectivity drops on the return hop: money taken, no
  ticket, no record. Stripe's fulfillment docs warn precisely about this:
  *"You cannot rely on triggering fulfillment solely from your Checkout
  success page because your customers are not guaranteed to visit this page."*
- **Card (Terminal):** after `terminal.processPayment()` succeeds, print + log
  are fire-and-forget (`Step4Payment.tsx`). Printer out of paper or an app
  crash in that window → charged, no ticket, no retry. On an unattended
  kiosk, "out of paper" is routine, not an edge case.

## Architecture decision: the Pi polls Stripe

**Constraint chain (the reasoning, preserved):**

1. The receipt printer is USB-attached to the Pi → only the Pi can print.
2. The Pi sits behind NAT on gym WiFi → Stripe cannot push webhooks to it.
3. Stripe's idiomatic answer is webhooks (polling is explicitly cautioned:
   *"Polling… isn't very reliable, might not work at high volumes, and Stripe
   enforces rate limiting"* — docs.stripe.com/payments/payment-intents/verifying-status).
4. Webhook delivery to the Pi would require either a public tunnel
   (Cloudflare Tunnel / Tailscale Funnel — a dev-pattern repurposed, one more
   daemon to keep alive) or a cloud backend. A cloud backend does not remove
   the problem: the Pi must still pull "go print" from the cloud (poll or
   persistent socket), so it adds a service while keeping the same weakness.
5. **Therefore: the Pi polls Stripe directly.** At kiosk volume (tens of
   transactions/day; one list call per method per minute) Stripe's polling
   cautions — volume and rate limits — do not bite. The poll is a
   reconciliation sweep, not a realtime primary signal; the present customer
   is served by a synchronous fast-path.

**Rejected alternatives** (documented so we don't re-litigate):

- *Stripe CLI `stripe listen` as production transport:* dev/test tool,
  ephemeral signing secret per session, and no backfill — events during
  listener downtime are lost. Reintroduces the exact failure mode.
- *Tunnel + registered webhook:* idiomatic (3-day automatic retries) but adds
  a tunnel daemon; rejected for a single self-contained kiosk.
- *Cloud backend:* the right shape **if this ever becomes multi-kiosk**
  (central key, central webhook, thin print clients). Over-engineering for
  one box. Revisit on a second kiosk.

## Verified against Stripe docs (per project rule: no memory-based claims)

- **Checkout fulfillment** (docs.stripe.com/checkout/fulfillment): fulfill via
  an idempotent function keyed by session id; *"may be called multiple times,
  possibly simultaneously"*; gate on `payment_status != 'unpaid'`; also trigger
  from the success page for the present customer, never rely on it alone.
  (Stripe's sample expands `line_items` because it fulfills from them; we
  fulfill from our own metadata + catalog, so we deliberately do not expand —
  cargo-culting the expand was flagged in review.)
- **TWINT** (docs.stripe.com/payments/twint): immediate success/failure
  notification, customer-initiated confirmation. Independent review corrected
  an earlier rationale: TWINT is *not* a delayed-notification method. The
  conservative handling stands for a different documented reason — the
  sessions list API defines `complete` as "payment processing may still be in
  progress", so a session can be `complete` but still `unpaid`; the sweep
  revisits until paid or expired.
- **Terminal/JS** (docs.stripe.com/terminal/payments/collect-card-payment):
  with `capture_method: automatic`, successful `processPayment` →
  PaymentIntent status `succeeded`. On unknown outcome: *"reprocess the
  original PaymentIntent. Do not create a new PaymentIntent"* — reinforces
  keying all recovery off existing Stripe ids.
- **`paymentIntents.list`** (API ref): filters by `created` range only — **no
  `status` or `metadata` filter** → filter in code.
- **`checkout.sessions.list`** (API ref): filters by `status` (`complete`) and
  `created` — **no `payment_status` or `metadata` filter** → filter those in
  code. Sessions expire 24h after creation by default.
- **Provenance honesty:** the Checkout half of this design is
  Stripe-prescribed. The card/PaymentIntent sweep is *our* reliability net —
  Stripe's Terminal docs handle the SDK result directly and do not prescribe
  list-based reconciliation. Defensible engineering, lower doc authority.

## Design

### Component 1 — Fulfillment engine (`src/lib/fulfillment.ts`, server-only)

One idempotent core, two thin adapters:

```
fulfillCheckoutSession(stripe, sessionId)   // TWINT
fulfillPaymentIntent(stripe, paymentIntentId) // card
```

Shared flow:

1. **Claim** the Stripe object id in the marker store (atomic
   exclusive-create). Already `done` → return `already-fulfilled`;
   `needs-attention` → return without retrying (see below).
2. **Retrieve** the object from Stripe. Never trust client-supplied data.
3. **Gate:** session → `payment_status !== 'unpaid'`; PI →
   `status === 'succeeded'`. Not payable → release claim, return `pending`
   (sweep revisits) or `not-payable` (expired/canceled).
4. **Rebuild** print + log payloads server-side from object `metadata`
   (`cartData`, `lang`) + the catalog. **The authoritative total is what
   Stripe charged** — `pi.amount` / `session.amount_total` — not a
   recomputation from the current catalog (review finding: a catalog price
   edit inside the 24h recovery window must not change the printed total).
   On mismatch with the catalog-derived sum, log loudly and still fulfill
   with the Stripe amount.
5. **Execute side-effects** by direct function call (no HTTP self-call):
   `printThermalReceipt(payload)`, `appendTransactionLog(payload)`.
6. **Mark done** (atomic rename of the marker file).

**Permanent vs transient failure (review finding):** a transient side-effect
failure (printer out of paper) releases the claim → the sweep retries. A
*permanent* rebuild failure (missing `cartData`, unknown product id after a
catalog edit) must NOT silently retry every 60s until it ages out of the 24h
window — that's a paid customer dropped on the floor. Instead it writes a
`needs-attention` marker: the sweep skips it, the marker is visible in
`data/fulfilled/`, and the sweep logs a single loud error when creating it.

### Component 2 — Exactly-once marker store (`src/lib/fulfillment-store.ts`)

- `data/fulfilled/<stripeObjectId>` marker files; claim via exclusive-create
  (`wx` flag), `claimed → done` via atomic rename. Survives restarts.
- In-process `Map<id, Promise>` mutex serializes concurrent callers (success
  fast-path vs sweep) within the single Next.js process.
- **At-least-once bias (explicit decision):** a crash between claim and done
  leaves a stale `claimed` marker; markers older than a short TTL (~2 min)
  are treated as retryable → may reprint. A duplicate receipt costs a slip of
  paper; a missed one is a paid customer with nothing. Reprint > skip.
- A third terminal state `needs-attention` (permanent rebuild failure) is
  never auto-retried; an operator resolves it manually.
- **Single-process assumption (documented per review):** the stale-claim
  takeover and the in-process mutex are only exactly-once under one
  `next start` process. Running this app clustered (PM2, multiple workers)
  could double-print. Acceptable under the at-least-once bias, but do not
  cluster this app without revisiting the store.

### Component 3 — Reconciliation sweep (`src/lib/reconcile.ts`)

Every cycle (default 60s), with an overlap guard and a 24h `created` lookback
(matches session expiry; covers any realistic outage):

- `checkout.sessions.list({ status: 'complete', created: { gte } })` →
  in-code filter `metadata.paymentMethod === 'twint' &&
  payment_status === 'paid'` → fulfill each not-yet-done. Paginate via
  auto-pagination.
- `paymentIntents.list({ created: { gte } })` → in-code filter
  `status === 'succeeded' && metadata.paymentMethod === 'card'` → fulfill
  each not-yet-done.
- Stripe is the pending-queue: no local pending state to corrupt. The only
  local state is the done-marker.

### Component 4 — Scheduler

- In-process interval started from `instrumentation.ts` (`register()` runs
  once per server start; guard against dev double-registration).
- Interval env override is validated with `Number.isFinite` (review finding:
  `Number('garbage')` is `NaN`, and `setInterval(cb, NaN)` is a ~1ms hot
  loop hammering Stripe).
- `POST /api/fulfill/reconcile` triggers one sweep manually (debugging,
  ops, future systemd timer if ever wanted). It runs through the same
  overlap-guarded entrypoint as the interval (review finding: calling the
  sweep directly would let concurrent POSTs amplify Stripe API calls).

### Component 5 — Fast-paths for the present customer (both methods)

- **TWINT:** `success_url` becomes
  `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}` (Stripe substitutes
  the id). `/success` becomes a server-rendered page that awaits
  `fulfillCheckoutSession(session_id)` then sends the customer back to the
  wizard. The page copy branches on outcome (review finding — it must not
  claim success unconditionally): `fulfilled` → success + collect receipt;
  `pending`/`in-progress`/`failed` → "payment processing — receipt will
  print shortly" (the sweep finishes/retries it); `not-payable` /
  missing/invalid session id → neutral "payment not completed" copy, no
  success claim.
- **Card:** in `Step4Payment.handleCardPayment`, replace client-side
  `completePayment(print+log)` with `POST /api/fulfill
  { paymentIntentId }` → runs `fulfillPaymentIntent`. Same instant receipt,
  now idempotent and recorded in the shared store (sweep dedups instead of
  double-printing).

### Component 6 — Deletions and refactors

- **Delete** the localStorage replay path: `stashPendingCompletion` /
  `takePendingCompletion` / `discardPendingCompletion`
  (`completion-client.ts`), the `twint_return` handling in `WizardRoot.tsx`,
  and the stash in the TWINT handler. The old `/success` client redirector is
  replaced by the server page.
- **Extract** `appendTransactionLog` into a server function
  (`src/lib/transaction-log.ts`). `printThermalReceipt` is already a server
  function (`src/lib/thermal-printer.ts`).
- **Delete `/api/print` and `/api/transactions/log` entirely** (review
  finding, user decision): after the fast-paths land they have no legitimate
  caller, and unauthenticated print/log endpoints on the LAN are a
  print-a-free-ticket / forge-the-audit-log vector. Fulfillment calls the
  server functions directly.
- **Bind the server to loopback** (`next start -H 127.0.0.1` in the systemd
  unit and setup script): the kiosk browser runs on the same Pi, the
  Checkout redirect lands in that same browser, and the WisePOS E talks
  outbound to Stripe — nothing legitimate needs LAN access to the app. This
  protects all API routes including the new `/api/fulfill*` (review finding;
  also closes roadmap Tier 1 #5 for this app).
- Card/Terminal payment *collection* is untouched; only its completion path
  changes.

## Edge cases

- **Async TWINT:** session `complete` but `unpaid` at redirect → fast-path
  returns `pending`, sweep fulfills when `paid`. `async_payment_failed`
  equivalent (never becomes paid) → never fulfilled; session expires; correct.
- **Customer pays, walks away, kiosk offline an hour:** next sweep after
  reboot finds the paid session within the 24h lookback → prints. (Receipt
  prints to an empty lobby — acceptable; the JSONL log is the auditable
  record either way.)
- **Printer out of paper (card):** fast-path claim happens, print fails →
  claim released / marker stays retryable → sweep reprints after paper
  refill. This converts today's silent loss into self-healing.
- **Duplicate Stripe objects** (until idempotency-keys spec ships): only the
  *paid/succeeded* object fulfills; abandoned duplicates never gate-pass.
- **Two sweeps overlap / sweep + fast-path race:** in-process mutex + atomic
  claim → exactly one execution per id.
- **Clock skew on `created.gte`:** lookback is 24h, sweep is every 60s —
  skew is irrelevant at that margin.

## Testing (Vitest, TDD)

- `fulfillment.test.ts`: paid session → fulfills once; unpaid → `pending`, no
  side-effects, claim released; succeeded PI → fulfills; non-succeeded PI →
  no side-effects; already-done → skipped; concurrent calls → one execution;
  payload rebuilt from metadata matches the payload built at creation time.
- `fulfillment-store.test.ts`: exclusive claim; done-dedup; stale-claim TTL
  retry; atomicity of rename (claim→done).
- `reconcile.test.ts`: lists with correct params; in-code filters (twint+paid,
  card+succeeded); fulfills only unmarked ids; overlap guard.
- Mocks: `vi.mock` Stripe client and printer/log modules; temp dir for the
  marker store.

## Review outcomes (independent best-practice agent, 2026-06-12)

Verdict: sound-with-changes; architecture confirmed (the reviewer's
independent model initially preferred tunnel+webhooks and conceded to the
polling rationale). All findings folded into this spec and the plan:
orphaned-route deletion + loopback binding, Stripe-amount-authoritative
totals, `needs-attention` markers, interval validation, overlap-guarded
manual route, outcome-branched `/success` copy, dropped `line_items` expand,
TWINT rationale correction, single-process assumption documented. One
cherry-pick: `create/route.ts` stops returning raw `error.message` to the
client (roadmap P1 #7; the file is already being touched).

## Out of scope

- Refunds / attendant recovery UI (roadmap Tier 0 #2 — next item).
- Card/Terminal *collection* changes, idempotency keys (separate approved
  spec on `feat/stripe-idempotency-keys`).
- Restricted API key + IP allowlist (roadmap Tier 1 #4; reviewer endorsed,
  deliberately its own item).
- `capture_method: manual` for card_present (Terminal docs recommend it for
  a reconciliation step; current code uses `automatic` — conscious decision
  deferred to the idempotency/capture workstream).
- Multi-kiosk cloud backend (revisit if a second kiosk ever exists).
- Webhook endpoint removal: `/api/webhooks/stripe` stays as-is (harmless,
  useful if a tunnel is ever added).
