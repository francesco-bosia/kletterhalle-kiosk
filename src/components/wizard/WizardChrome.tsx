'use client';

import { useWizard } from '@/lib/wizard-context';
import { StepHeader } from '@/components/wizard/StepHeader';
import { StepFooter } from '@/components/wizard/StepFooter';
import { Step1Tickets } from '@/components/wizard/Step1Tickets';
import { Step2Shoes } from '@/components/wizard/Step2Shoes';
import { Step3Summary } from '@/components/wizard/Step3Summary';
import { Step4Payment } from '@/components/wizard/Step4Payment';
import { IdleWatcher } from '@/components/wizard/IdleWatcher';

export function WizardChrome() {
  const { state } = useWizard();

  return (
    <div className="wizard-root flex h-screen flex-col bg-white">
      <StepHeader />

      <main className="flex-1 overflow-y-auto">
        {state.step === 1 && <Step1Tickets />}
        {state.step === 2 && <Step2Shoes />}
        {state.step === 3 && <Step3Summary />}
        {(state.step === 4 || state.phase === 'success') && <Step4Payment />}
      </main>

      {state.phase !== 'success' && <StepFooter />}

      <IdleWatcher />
    </div>
  );
}
