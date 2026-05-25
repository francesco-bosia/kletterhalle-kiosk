'use client';

import { useReducer } from 'react';
import { wizardReducer, createInitialState } from '@/lib/wizard';
import { WizardReactContext } from '@/lib/wizard-context';
import { TerminalProvider } from '@/components/terminal-provider';
import { WizardChrome } from '@/components/wizard/WizardChrome';

export default function WizardRoot() {
  const [state, dispatch] = useReducer(wizardReducer, createInitialState());

  return (
    <WizardReactContext.Provider value={{ state, dispatch }}>
      <TerminalProvider>
        <WizardChrome />
      </TerminalProvider>
    </WizardReactContext.Provider>
  );
}
