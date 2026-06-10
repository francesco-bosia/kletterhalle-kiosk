export interface TapState {
  count: number;
  lastTapAt: number | null;
}

export const INITIAL_TAP_STATE: TapState = { count: 0, lastTapAt: null };

/**
 * Pure tap-counter step. Increments the run when a tap arrives within `maxGapMs`
 * of the previous tap; otherwise restarts the run at 1.
 */
export function registerTap(state: TapState, now: number, maxGapMs: number): TapState {
  if (state.lastTapAt !== null && now - state.lastTapAt > maxGapMs) {
    return { count: 1, lastTapAt: now };
  }
  return { count: state.count + 1, lastTapAt: now };
}
