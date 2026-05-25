'use client';

import { useWizard } from '@/lib/wizard-context';
import { t } from '@/lib/i18n';

export function StepHeader() {
  const { state, dispatch } = useWizard();
  const { step, lang } = state;

  const stepLabel = t('chrome.stepLabel', lang);
  const isBackDisabled = step === 1;

  function handleBack() {
    if (isBackDisabled) return;
    dispatch({ type: 'GO_TO_STEP', step: (step - 1) as 1 | 2 | 3 | 4 });
  }

  function handleToggleLang() {
    const next = lang === 'it' ? 'en' : 'it';
    dispatch({ type: 'SET_LANG', lang: next });
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
      {/* Step pill — tappable to go back */}
      <button
        onClick={handleBack}
        disabled={isBackDisabled}
        className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
          isBackDisabled
            ? 'cursor-default bg-gray-100 text-gray-400'
            : 'cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200 active:bg-blue-300'
        }`}
      >
        {stepLabel} {step} / 4
      </button>

      {/* Language toggle */}
      <button
        onClick={handleToggleLang}
        className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 active:bg-gray-200"
      >
        {lang === 'it' ? 'IT | EN' : 'EN | IT'}
      </button>
    </header>
  );
}
