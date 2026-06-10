'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWizard } from '@/lib/wizard-context';
import { t } from '@/lib/i18n';

type IdlePhase = 'armed' | 'prompting';

const IDLE_TIMEOUT_MS = 60_000;
const PROMPT_TIMEOUT_MS = 10_000;

export function IdleWatcher() {
  const { state, dispatch } = useWizard();
  const [phase, setPhase] = useState<IdlePhase>('armed');

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseRef = useRef<IdlePhase>(phase);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const clearTimers = useCallback(() => {
    if (idleTimerRef.current !== null) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (promptTimerRef.current !== null) {
      clearTimeout(promptTimerRef.current);
      promptTimerRef.current = null;
    }
  }, []);

  const startIdleTimer = useCallback(() => {
    clearTimers();
    idleTimerRef.current = setTimeout(() => {
      setPhase('prompting');
    }, IDLE_TIMEOUT_MS);
  }, [clearTimers]);

  const startPromptTimer = useCallback(() => {
    if (promptTimerRef.current !== null) {
      clearTimeout(promptTimerRef.current);
    }
    promptTimerRef.current = setTimeout(() => {
      dispatch({ type: 'RESET_SESSION' });
      setPhase('armed');
    }, PROMPT_TIMEOUT_MS);
  }, [dispatch]);

  // Reset to armed and restart the idle timer
  const resetAndArm = useCallback(() => {
    setPhase('armed');
    startIdleTimer();
  }, [startIdleTimer]);

  // Main effect: set up the idle timer and pointer listener when not on step 4
  useEffect(() => {
    // Disable idle timer during payment step
    if (state.step === 4) {
      clearTimers();
      // Use a timeout to avoid synchronous setState in effect body
      const t = setTimeout(() => setPhase('armed'), 0);
      return () => {
        clearTimeout(t);
      };
    }

    // Start the idle timer whenever we enter this effect (step changes, etc.)
    startIdleTimer();

    const handlePointerDown = () => {
      if (phaseRef.current === 'armed') {
        // Reset the idle timer on any interaction
        startIdleTimer();
      } else if (phaseRef.current === 'prompting') {
        // Dismiss modal on interaction
        resetAndArm();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      clearTimers();
    };
  }, [state.step, clearTimers, startIdleTimer, resetAndArm]);

  // Separate effect: manage the prompt (auto-reset) timer
  useEffect(() => {
    if (phase === 'prompting' && state.step !== 4) {
      startPromptTimer();
    }

    return () => {
      if (promptTimerRef.current !== null) {
        clearTimeout(promptTimerRef.current);
        promptTimerRef.current = null;
      }
    };
  }, [phase, state.step, startPromptTimer]);

  // Confirm button handler
  const handleConfirm = useCallback(() => {
    resetAndArm();
  }, [resetAndArm]);

  if (phase !== 'prompting' || state.step === 4) {
    return null;
  }

  const lang = state.lang;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="w-[90%] max-w-md rounded-2xl bg-white px-10 py-12 text-center shadow-2xl">
        <h2 className="mb-4 text-3xl font-bold tracking-tight text-black">
          {t('idle.title', lang)}
        </h2>

        <p className="mb-8 text-lg leading-relaxed text-gray-500">
          {t('idle.message', lang)}
        </p>

        <button
          onClick={handleConfirm}
          className="rounded-xl bg-black px-12 py-4 text-xl font-semibold text-white transition-colors hover:bg-gray-800 active:bg-gray-700"
        >
          {t('idle.confirm', lang)}
        </button>
      </div>
    </div>
  );
}
