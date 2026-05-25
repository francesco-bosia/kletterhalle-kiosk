'use client';

import { createContext, useContext } from 'react';
import type { WizardContext } from './wizard';

/**
 * The actual React context for the wizard state machine.
 * The WizardContext *type* lives in ./wizard.ts (no React dependency).
 * This module creates the runtime context object and the useWizard hook.
 */
export const WizardReactContext = createContext<WizardContext | null>(null);

/**
 * Convenience hook: read wizard state and dispatch from context.
 * Must be used inside <WizardRoot>.
 */
export function useWizard(): WizardContext {
  const ctx = useContext(WizardReactContext);
  if (!ctx) {
    throw new Error('useWizard must be used within a WizardRoot');
  }
  return ctx;
}
