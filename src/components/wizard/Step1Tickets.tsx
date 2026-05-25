'use client';

import { useWizard } from '@/lib/wizard-context';

export function Step1Tickets() {
  const { state } = useWizard();

  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-lg text-gray-500">Step 1: Tickets (placeholder)</p>
    </div>
  );
}
