'use client';

import { useWizard } from '@/lib/wizard-context';

export function Step4Payment() {
  const { state } = useWizard();

  return (
    <div className="flex items-center justify-center p-8">
      <p className="text-lg text-gray-500">Step 4: Payment (placeholder)</p>
    </div>
  );
}
