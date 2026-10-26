---
name: updating-versions
description: Use when checking dependency or runtime versions, planning a security or dependency bump (npm packages, Node.js, Next/React/Stripe), testing an updated build in Stripe test mode, or deploying an updated build to the Raspberry Pi kiosk. Triggers include "versions still ok?", "version bump", "security update", npm audit findings, Node.js security release.
---

# Updating Versions (kletterhalle-kiosk)

## Overview

Cycle: audit → bump → test-mode test on the dev box → Pi deploy → no-charge live smoke.
Most mechanics are derivable from the repo itself (`scripts/deploy.sh`, `engines` + `.npmrc` + `.nvmrc`, `scripts/simulate-card-tap.js`, `docs/deployment/`). This skill holds the five traps that are **not** recorded anywhere else in the repo — skip them and deploys hang or mix unsafe changes.

## Non-negotiable traps

1. **`deploy.sh` is NOT safe to run unattended over key-based SSH.** Its `sudo systemctl restart kletterhalle` needs a password TTY, which BatchMode SSH cannot provide. Split it: run pull / `npm ci` / build over SSH yourself, then hand the user this one-liner for the sudo step:
   `ssh -t kletterhalle 'sudo systemctl restart kletterhalle && systemctl status kletterhalle --no-pager | head -3'`
   then restart the browser yourself: `ssh kletterhalle 'systemctl --user restart kiosk-browser'`.
2. **When Node itself changes, deploy in two windows.** Window 1: install/switch Node (nvm on both machines), re-run `scripts/setup-systemd.sh` on the Pi (re-points `/usr/local/bin/{node,npm}`; needs the same sudo handoff), restart, and **verify the OLD build still serves on the new Node**. Window 2: pull + `npm ci` + build + restart. Always load the new Node **before** `npm ci` — `.npmrc` `engine-strict` hard-fails otherwise. Over non-interactive SSH, check `/usr/local/bin/node -v` (nvm is not on that PATH).
3. **Stripe API pin discipline.** The explicit `apiVersion` in `src/lib/stripe.ts` must equal the installed SDK's `LatestApiVersion` or the TypeScript build fails. When moving it, verify the changelog between the two versions is additive-only for the surfaces this app uses (PaymentIntents, Terminal, Checkout/TWINT, webhooks). **REQUIRED:** use the `upgrade-stripe` skill for any Stripe SDK or API-version bump.
4. **Dev box and Pi are different Stripe accounts.** Local `.env.local` is a sandbox/test key on a *different account* than the Pi's live key. Never diagnose production payment issues from local env — read state from the Pi's live key or the Stripe Dashboard.
5. **Live smoke is no-charge by default.** Verify: page 200; `/api/terminal/state` → `readerOnline: true`; create a PaymentIntent via the app then cancel it (never charge); journal clean. A real charge+refund only happens when the user explicitly opts in.

## Phase checklist

- **Audit:** `nvm use` per `.nvmrc`; `npm outdated`; `npm audit --omit=dev` is the prod signal (dev-only findings → document & accept, don't downgrade); majors without a security driver → defer and list as known debt; check Node security releases against `node -v` on **both** machines.
- **Bump:** update `engines` floor in `package.json`, `.npmrc`, `.nvmrc` together; vitest 5 needs typed `Mock<fnType>` mocks; new react-hooks errors → prove bump-introduced by re-installing the old plugin, then prefer an inline disable over refactoring live payment code; if arm64 `npm ci` misses `@emnapi/*`, regenerate on the dev box: `npm install --package-lock-only --cpu=wasm32 --os=linux`, commit, push.
- **Test:** `npm run lint && npm test`; dev server + `node scripts/simulate-card-tap.js` in a second process (test-mode card taps hang forever without it); user validates from their phone over Tailscale; test TWINT too.
- **Deploy:** commit + push; SSH pre-flight on `kletterhalle` (disk space, clean tree, save `git rev-parse HEAD` as the rollback sha, `/usr/local/bin/node -v`); `rm -rf .next` before building (stale dev typegen → TS2307 for long-deleted routes); skip `npm ci` when the lockfile didn't change; restarts per trap 1.
- **Smoke:** trap 5, plus spot-check a version-specific string in the served HTML — a 200 alone doesn't prove the new build is running. Rollback: `git checkout <sha> && rm -rf .next` + build + restart both services.

## Common mistakes

| Mistake | Reality |
|---|---|
| "deploy.sh says safe to disconnect — run it over SSH" | The sudo step hangs without a TTY; split the restart out (trap 1) |
| Node + packages in one deploy window | If it breaks you can't tell runtime from code — two windows, verify between (trap 2) |
| `npm ci` before loading the new Node | `engine-strict` refuses; Node first |
| Treating HTTP 200 as deploy proof | Spot-check new content in the served HTML |
| Debugging a live payment issue from the dev box | Different Stripe account — use the Pi key or Dashboard (trap 4) |
| Charging a real card "to be thorough" | Smoke stays no-charge unless the user opts in (trap 5) |
