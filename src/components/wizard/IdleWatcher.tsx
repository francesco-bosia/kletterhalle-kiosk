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
  phaseRef.current = phase;

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
      setPhase('armed');
      return;
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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          padding: '48px 40px',
          maxWidth: '480px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
      >
        <h2
          style={{
            fontSize: '28px',
            fontWeight: 700,
            marginBottom: '16px',
            color: '#1a1a1a',
          }}
        >
          {t('idle.title', lang)}
        </h2>

        <p
          style={{
            fontSize: '18px',
            color: '#555',
            marginBottom: '32px',
            lineHeight: 1.5,
          }}
        >
          {t('idle.message', lang)}
        </p>

        <button
          onClick={handleConfirm}
          style={{
            fontSize: '20px',
            fontWeight: 600,
            padding: '16px 48px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: '#2563eb',
            color: '#ffffff',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
          }}
        >
          {t('idle.confirm', lang)}
        </button>
      </div>
    </div>
  );
}
