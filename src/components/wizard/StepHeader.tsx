'use client';

import { useWizard } from '@/lib/wizard-context';
import { t } from '@/lib/i18n';

export function StepHeader() {
  const { state, dispatch } = useWizard();
  const { step, lang } = state;

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
    <header className="flex items-center justify-between px-5 py-3">
      {/* Step pill — tappable to go back */}
      <button
        onClick={handleBack}
        disabled={isBackDisabled}
        className={`inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold tracking-wide transition-colors ${
          isBackDisabled
            ? 'bg-black text-white'
            : 'bg-black text-white hover:bg-gray-800 active:bg-gray-700'
        }`}
      >
        STEP {step} / 4
      </button>

      {/* Language toggle */}
      <button
        onClick={handleToggleLang}
        className="text-sm font-medium text-gray-400 transition-colors hover:text-gray-600"
      >
        IT&nbsp;/&nbsp;EN
      </button>
    </header>
  );
}
