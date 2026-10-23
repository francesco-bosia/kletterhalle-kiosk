#!/usr/bin/env node
/**
 * Simulate customer card taps for the server-driven Terminal flow in TEST MODE.
 *
 * Stripe's simulated readers no longer auto-present the card for the
 * server-driven integration (SDK-driven ones still do). Without a tap the
 * reader action sits in_progress forever and the PaymentIntent stays at
 * requires_payment_method — see docs.stripe.com/terminal/references/testing
 * ("Simulated card presentment").
 *
 * Run this alongside `npm start` during local test sessions; it watches the
 * reader and fires test_helpers present_payment_method whenever a
 * process_payment_intent action starts.
 *
 * TEST MODE ONLY: present_payment_method is a test_helpers endpoint and fails
 * in live mode — the script refuses to run against a non sk_test key.
 *
 * Usage: node scripts/simulate-card-tap.js   (reads .env.local when env unset)
 */
'use strict';

const fs = require('fs');
const path = require('path');

// Load .env.local without adding a dependency; real env vars win.
const envFile = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const key = process.env.STRIPE_SECRET_KEY;
const readerId = process.env.STRIPE_TERMINAL_READER_ID;
if (!key || !readerId) {
  console.error('Need STRIPE_SECRET_KEY and STRIPE_TERMINAL_READER_ID (env or .env.local)');
  process.exit(1);
}
if (!key.startsWith('sk_test')) {
  console.error(`Refusing: ${key.slice(0, 7)}… is not a test key. This script is test mode only.`);
  process.exit(1);
}

const Stripe = require('stripe');
const stripe = new Stripe(key, { apiVersion: '2026-08-26.dahlia' });

let presentedFor = null; // PI id already tapped for — one tap per action

async function tick() {
  try {
    const reader = await stripe.terminal.readers.retrieve(readerId);
    const action = reader.action;
    if (
      action?.type === 'process_payment_intent' &&
      action.status === 'in_progress'
    ) {
      const target = action.process_payment_intent?.payment_intent;
      const piId = typeof target === 'string' ? target : target?.id;
      if (piId && piId !== presentedFor) {
        presentedFor = piId;
        console.log(`${new Date().toISOString()} tapping for ${piId} …`);
        await stripe.testHelpers.terminal.readers.presentPaymentMethod(readerId);
        console.log(`${new Date().toISOString()} tap simulated for ${piId}`);
      }
    }
  } catch (err) {
    console.error(`${new Date().toISOString()} error: ${err.message}`);
  }
}

console.log(`Watching reader ${readerId} for card-payment actions; Ctrl+C to stop.`);
setInterval(tick, 1000);
