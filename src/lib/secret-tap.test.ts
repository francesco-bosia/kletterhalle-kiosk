import { describe, it, expect } from 'vitest';
import { INITIAL_TAP_STATE, registerTap } from './secret-tap';

describe('registerTap', () => {
  it('counts consecutive quick taps', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 200, 1000);
    s = registerTap(s, 400, 1000);
    expect(s.count).toBe(3);
  });

  it('restarts the run when a tap arrives after the gap', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 500, 1000);
    expect(s.count).toBe(2);
    s = registerTap(s, 2000, 1000); // 1500ms gap > 1000
    expect(s.count).toBe(1);
  });

  it('treats a gap exactly equal to maxGap as still within the run', () => {
    let s = INITIAL_TAP_STATE;
    s = registerTap(s, 0, 1000);
    s = registerTap(s, 1000, 1000); // gap == maxGap, not > maxGap
    expect(s.count).toBe(2);
  });
});
