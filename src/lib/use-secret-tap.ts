'use client';

import { useCallback, useRef } from 'react';
import { INITIAL_TAP_STATE, registerTap, type TapState } from './secret-tap';

interface UseSecretTapOptions {
  count: number;
  maxGapMs: number;
  onActivate: () => void;
}

/**
 * Returns a tap handler that fires `onActivate` once `count` taps occur with
 * less than `maxGapMs` between consecutive taps. Uses Date.now() for timing
 * (client-only). The run resets after firing.
 */
export function useSecretTap({ count, maxGapMs, onActivate }: UseSecretTapOptions): () => void {
  const stateRef = useRef<TapState>(INITIAL_TAP_STATE);

  return useCallback(() => {
    const next = registerTap(stateRef.current, Date.now(), maxGapMs);
    if (next.count >= count) {
      stateRef.current = INITIAL_TAP_STATE;
      onActivate();
      return;
    }
    stateRef.current = next;
  }, [count, maxGapMs, onActivate]);
}
