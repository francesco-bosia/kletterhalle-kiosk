# Transaction Database — Design Spec

## Overview

Persist every completed kiosk transaction to a PostgreSQL database running on a Hetzner VPS (46.224.204.3). The kiosk (Raspberry Pi) communicates with the VPS over a Tailscale mesh network. A thin Hono API on the VPS accepts transaction writes from the kiosk and stores them via Drizzle ORM.

Write-only for now. Admin endpoints and authentication will be added later.

## Architecture

```
[ Kiosk (Pi) ]          Tailscale mesh          [ Hetzner VPS ]
                     (WireGuard encrypted)

  Next.js app              |                   +--------------------+
  +--------------+         |                   |  Hono API          |
  | Webhook /    |--- HTTP ------------------->|  :3001             |
  | Payment flow |   (Tailscale IP:3001)       |  API key auth      |
  +--------------+                             |  Drizzle ORM       |
                                               +--------+-----------+
                                                        |
                                               +--------v-----------+
                                               |  PostgreSQL         |
                                               |  localhost:5432     |
                                               +--------------------+
```

### Components

| Component | Location | Role |
|---|---|---|
| Next.js kiosk app | Raspberry Pi | Existing app. Calls VPS API after each successful payment. |
| Hono API | Hetzner VPS | Single-endpoint service. Validates and writes transactions. |
| PostgreSQL | Hetzner VPS | Persists transaction data. Listens on localhost only. |
| Tailscale | Both | Encrypted mesh network. No ports exposed to the public internet. |

### Data Flow

1. Customer completes a payment (TWINT or card).
2. Stripe webhook fires. The existing webhook handler processes the payment.
3. After the existing JSONL log, the webhook handler calls `POST https://<tailscale-ip>:3001/api/transactions` with the transaction data and an API key.
4. The VPS Hono API validates the API key and payload, inserts into PostgreSQL.
5. If the VPS call fails, the payment still succeeds. The local JSONL file is the fallback. The error is logged server-side.

## Database Schema

Single `transactions` table:

```sql
CREATE TABLE transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  code            TEXT NOT NULL,              -- Stripe PaymentIntent ID or Checkout Session ID
  payment_method  TEXT NOT NULL,              -- 'twint' | 'card'
  total_cents     INTEGER NOT NULL,           -- Total in Rappen/centimes
  items           JSONB NOT NULL,             -- Array of line items
  language        TEXT NOT NULL DEFAULT 'it'  -- 'it' | 'en'
);

CREATE INDEX idx_transactions_created_at ON transactions (created_at);
CREATE INDEX idx_transactions_code ON transactions (code);
```

### Items JSONB structure

```json
[
  {
    "ticketId": "adult",
    "name": "Biglietto adulto",
    "quantity": 2,
    "price_cents": 700
  },
  {
    "ticketId": "shoes",
    "name": "Scarpe a noleggio",
    "quantity": 1,
    "price_cents": 600
  }
]
```

## VPS API (Hono)

### Endpoint

**`POST /api/transactions`**

- **Auth:** `Authorization: Bearer <API_KEY>` header. Returns `401` if missing or invalid.
- **Content-Type:** `application/json`
- **Payload validation:** Zod schema matching the table columns.
- **Response:** `201 Created` with `{ id, created_at }` on success.
- **Errors:** `400` (validation), `401` (auth), `500` (DB error).

### Request payload

```json
{
  "code": "pi_3ABC123...",
  "payment_method": "card",
  "total_cents": 2000,
  "items": [
    { "ticketId": "adult", "name": "Biglietto adulto", "quantity": 2, "price_cents": 700 }
  ],
  "language": "it"
}
```

### Zod validation schema

```typescript
const transactionSchema = z.object({
  code: z.string().min(1),
  payment_method: z.enum(["twint", "card"]),
  total_cents: z.number().int().positive(),
  items: z.array(z.object({
    ticketId: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().positive(),
    price_cents: z.number().int().nonnegative(),
  })).min(1),
  language: z.enum(["it", "en"]).default("it"),
});
```

### Binding

The Hono app binds to the Tailscale IP only (not `0.0.0.0`). PostgreSQL listens on `localhost:5432` only.

## Kiosk Changes

### Files to modify

- `src/app/api/webhooks/stripe/route.ts` — add VPS API call after existing JSONL logging

### Implementation

Add a helper function that calls the VPS API. Called in both the `checkout.session.completed` and `payment_intent.succeeded` webhook handlers, after the existing `logTransaction()` call.

```typescript
async function persistToVps(data: TransactionPayload): Promise<void> {
  try {
    const res = await fetch(`https://${process.env.VPS_TAILSCALE_IP}:3001/api/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.VPS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      console.error(`VPS persist failed: ${res.status}`, await res.text());
    }
  } catch (err) {
    console.error("VPS persist error:", err);
  }
}
```

Key properties:
- **Non-blocking.** If the VPS is unreachable, the webhook still returns 200. The JSONL log is the fallback.
- **Fire-and-forget.** No retry logic. If we need reliability later, we can add a queue.

### New environment variables

```
VPS_TAILSCALE_IP=100.x.x.x
VPS_API_KEY=<generated-secret>
```

## VPS Setup Checklist

Steps the user performs on the Hetzner VPS:

1. **Install PostgreSQL**
   ```bash
   sudo apt update && sudo apt install postgresql postgresql-contrib
   ```

2. **Create database and user**
   ```bash
   sudo -u postgres createuser kiosk -P
   sudo -u postgres createdb kiosk -O kiosk
   ```

3. **Enable UUID extension**
   ```sql
   sudo -u postgres psql kiosk -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
   ```

4. **Install Node.js** (if not present)
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt install nodejs
   ```

5. **Install Tailscale** (if not present)
   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```

6. **Deploy the Hono API**
   - Clone or copy the API project to `/opt/kiosk-api`
   - `npm install && npm run build`
   - Create `.env` with `DATABASE_URL`, `API_KEY`, `TAILSCALE_IP`

7. **Run as systemd service**
   - Create `/etc/systemd/system/kiosk-api.service`
   - `sudo systemctl enable kiosk-api && sudo systemctl start kiosk-api`

8. **Note the Tailscale IP**
   - `tailscale ip -4` on the VPS gives the IP for the kiosk's `VPS_TAILSCALE_IP` env var

## Project Structure (VPS API)

```
kiosk-api/
  src/
    index.ts          # Hono app, routes, startup
    db.ts             # Drizzle client + connection
    schema.ts         # Drizzle schema (transactions table)
    env.ts            # Environment variable validation
  drizzle.config.ts   # Drizzle Kit config
  package.json
  tsconfig.json
  .env                # DATABASE_URL, API_KEY, TAILSCALE_IP
```

This will be a separate repository/directory from the kiosk Next.js app.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Database | PostgreSQL | Production-grade, supports future admin auth, concurrent access |
| API framework | Hono | Lightweight, fast, TypeScript-first |
| ORM | Drizzle | Thin abstraction, SQL-like, no heavy runtime |
| Validation | Zod | Runtime type safety, integrates with Hono |
| Network | Tailscale | Encrypted, no public ports, zero firewall config |
| Auth | Static API key | Sufficient for single kiosk, upgradable to JWT later |
| Migration | None | Start fresh, keep old JSONL files as archive |
| VPS call failure | Silent fallback to JSONL | Payment never blocked by DB issues |

## Out of Scope

- Admin dashboard or query endpoints
- Migration of existing JSONL data
- JWT / multi-user authentication
- Retry queue for failed VPS calls
- Multi-kiosk support
- HTTPS / nginx (Tailscale handles encryption)
