'use client';

interface StepTitleProps {
  it: string;
  en: string;
  descriptionIt?: string;
  descriptionEn?: string;
}

/**
 * Standard title block for wizard steps.
 * Renders Italian title as display heading, English as italic subtitle.
 * Optional bilingual description block, left-aligned.
 */
export function StepTitle({ it, en, descriptionIt, descriptionEn }: StepTitleProps) {
  return (
    <div className="mb-6">
      <h1 className="text-5xl font-black text-black tracking-tight leading-[1.05]">
        {it}
      </h1>
      <p className="text-xl italic text-gray-400 mt-2">
        {en}
      </p>

      {(descriptionIt || descriptionEn) && (
        <>
          <p className="text-base text-gray-500 mt-6">
            {descriptionIt}
            {descriptionIt && descriptionEn && <br />}
            {descriptionEn}
          </p>
          <hr className="border-gray-200 mt-6" />
        </>
      )}
    </div>
  );
}
