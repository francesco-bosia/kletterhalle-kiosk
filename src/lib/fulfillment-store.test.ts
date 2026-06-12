import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { FulfillmentStore } from '@/lib/fulfillment-store';

let dir: string;
let store: FulfillmentStore;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fulfill-'));
  store = new FulfillmentStore(dir);
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('FulfillmentStore', () => {
  it('claims a new id', async () => {
    expect(await store.claim('pi_1')).toBe('claimed');
  });

  it('reports in-progress for a fresh concurrent claim', async () => {
    await store.claim('pi_1');
    expect(await store.claim('pi_1')).toBe('in-progress');
  });

  it('reports already-done after markDone', async () => {
    await store.claim('pi_1');
    await store.markDone('pi_1');
    expect(await store.claim('pi_1')).toBe('already-done');
    expect(await store.isDone('pi_1')).toBe(true);
  });

  it('release allows re-claiming', async () => {
    await store.claim('pi_1');
    await store.release('pi_1');
    expect(await store.claim('pi_1')).toBe('claimed');
  });

  it('takes over a stale claim (crash recovery, at-least-once bias)', async () => {
    await store.claim('pi_1');
    // age the claim file beyond the TTL
    const old = (Date.now() - 10 * 60 * 1000) / 1000;
    await fs.utimes(path.join(dir, 'pi_1.claimed'), old, old);
    expect(await store.claim('pi_1')).toBe('claimed');
  });

  it('isDone is false for unknown ids', async () => {
    expect(await store.isDone('pi_nope')).toBe(false);
  });

  it('needs-attention parks an id: not claimable, not done', async () => {
    await store.claim('pi_1');
    await store.markNeedsAttention('pi_1', 'Unknown product id: ghost');
    expect(await store.claim('pi_1')).toBe('needs-attention');
    expect(await store.isDone('pi_1')).toBe(false);
    expect(await store.needsAttention('pi_1')).toBe(true);
  });

  it('markNeedsAttention is safe on an unclaimed id', async () => {
    await store.markNeedsAttention('pi_never', 'orphaned');
    expect(await store.needsAttention('pi_never')).toBe(true);
    expect(await store.claim('pi_never')).toBe('needs-attention');
  });

  it('rejects ids that are not stripe-shaped', async () => {
    await expect(store.claim('../../etc/passwd')).rejects.toThrow(/Invalid fulfillment id/);
  });
});
