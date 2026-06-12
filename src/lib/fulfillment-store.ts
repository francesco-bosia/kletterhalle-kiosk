import { promises as fs } from 'fs';
import path from 'path';

export type ClaimResult =
  | 'claimed'
  | 'in-progress'
  | 'already-done'
  | 'needs-attention';

const STALE_CLAIM_MS = 2 * 60 * 1000;

/**
 * Exactly-once marker store keyed by Stripe object id (pi_… / cs_…).
 * Claim = exclusive-create of `<id>.claimed`; done = atomic rename to
 * `<id>.done`. A claim older than STALE_CLAIM_MS is treated as a crashed
 * attempt and taken over (at-least-once bias: reprint > skip — see spec).
 * `<id>.needs-attention` marks a permanent failure (e.g. product removed
 * from catalog): never auto-retried, an operator resolves it.
 *
 * SINGLE-PROCESS ASSUMPTION: the stale-claim takeover and the engine's
 * in-process mutex are exactly-once only under one `next start` process.
 * Do not run this app clustered without revisiting this store.
 */
export class FulfillmentStore {
  constructor(
    private dir: string = path.join(process.cwd(), 'data', 'fulfilled')
  ) {}

  private donePath(id: string): string {
    return path.join(this.dir, `${id}.done`);
  }

  private claimPath(id: string): string {
    return path.join(this.dir, `${id}.claimed`);
  }

  private attentionPath(id: string): string {
    return path.join(this.dir, `${id}.needs-attention`);
  }

  async isDone(id: string): Promise<boolean> {
    try {
      await fs.access(this.donePath(id));
      return true;
    } catch {
      return false;
    }
  }

  async needsAttention(id: string): Promise<boolean> {
    try {
      await fs.access(this.attentionPath(id));
      return true;
    } catch {
      return false;
    }
  }

  /** Permanent failure: park the id so the sweep stops retrying it. */
  async markNeedsAttention(id: string, reason: string): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    await fs.writeFile(
      this.attentionPath(id),
      `${new Date().toISOString()} ${reason}\n`
    );
    await fs.rm(this.claimPath(id), { force: true });
  }

  async claim(id: string): Promise<ClaimResult> {
    await fs.mkdir(this.dir, { recursive: true });
    if (await this.isDone(id)) return 'already-done';
    if (await this.needsAttention(id)) return 'needs-attention';
    try {
      await fs.writeFile(this.claimPath(id), new Date().toISOString(), {
        flag: 'wx',
      });
      return 'claimed';
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
      const stat = await fs.stat(this.claimPath(id));
      if (Date.now() - stat.mtimeMs > STALE_CLAIM_MS) {
        await fs.writeFile(this.claimPath(id), new Date().toISOString());
        return 'claimed';
      }
      return 'in-progress';
    }
  }

  async markDone(id: string): Promise<void> {
    await fs.rename(this.claimPath(id), this.donePath(id));
  }

  async release(id: string): Promise<void> {
    await fs.rm(this.claimPath(id), { force: true });
  }
}

/** Default singleton used by the engine; tests construct their own. */
export const fulfillmentStore = new FulfillmentStore();
