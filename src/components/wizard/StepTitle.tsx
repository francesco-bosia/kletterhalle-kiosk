'use client';

import { useSecretTap } from '@/lib/use-secret-tap';

interface StepTitleProps {
  it: string;
  en: string;
  descriptionIt?: string;
  descriptionEn?: string;
  /** When provided, 5 quick taps (<1s apart) on the heading fire this callback. */
  onSecretActivate?: () => void;
}

/**
 * Standard title block for wizard steps.
 * Renders Italian title as display heading, English as italic subtitle.
 * Optional bilingual description block, left-aligned.
 */
export function StepTitle({ it, en, descriptionIt, descriptionEn, onSecretActivate }: StepTitleProps) {
  const handleSecretTap = useSecretTap({
    count: 5,
    maxGapMs: 1000,
    onActivate: onSecretActivate ?? (() => {}),
  });

  return (
    <div className="mb-6">
      <h1
        className="text-4xl font-black text-black tracking-tight leading-[1.05]"
        onClick={onSecretActivate ? handleSecretTap : undefined}
      >
        {it}
      </h1>
      <p className="text-lg italic text-gray-400 mt-1">
        {en}
      </p>

      {(descriptionIt || descriptionEn) && (
        <>
          <p className="text-base text-gray-500 mt-6">
            {descriptionIt}
            {descriptionIt && descriptionEn && <br />}
            {descriptionEn}
          </p>
          <hr className="border-gray-200 mt-3" />
        </>
      )}
    </div>
  );
}
