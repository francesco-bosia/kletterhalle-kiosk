"use client";

import { useWizard } from "@/lib/wizard-context";

const STEPS = [
  { num: 1, label: "biglietti" },
  { num: 2, label: "scarpette" },
  { num: 3, label: "riepilogo" },
  { num: 4, label: "pagamento" },
] as const;

export function StepHeader() {
  const { state, dispatch } = useWizard();
  const { step, phase } = state;

  const isDisabled =
    phase === "paying" || phase === "success" || phase === "failed";

  function goToStep(targetStep: 1 | 2 | 3 | 4) {
    if (isDisabled) return;
    if (targetStep >= step) return;
    dispatch({ type: "GO_TO_STEP", step: targetStep });
  }

  const pillBase =
    "rounded-full px-2.5 text-[10px] font-semibold tracking-tight uppercase " +
    "whitespace-nowrap h-6 transition-colors";

  return (
    <header className="flex items-center gap-2 px-3 pt-3 pb-3 border-b border-gray-200">
      {STEPS.map(({ num, label }) => {
        const isActive = step === num;
        const isPast = num < step;
        const stepNum = num as 1 | 2 | 3 | 4;

        // Color state classes
        const activeClasses = "bg-black text-white";
        const pastClasses =
          "bg-gray-200 text-black hover:bg-gray-300 active:bg-gray-400";
        const futureClasses = "bg-gray-100 text-gray-400";

        const pillClasses = isActive
          ? `${pillBase} ${activeClasses}`
          : isPast
            ? `${pillBase} ${pastClasses}`
            : `${pillBase} ${futureClasses}`;

        return (
          <button
            key={num}
            type="button"
            onClick={() => goToStep(stepNum)}
            disabled={isActive || !isPast || isDisabled}
            className={`${pillClasses} flex-1`}
            aria-current={isActive ? "step" : undefined}
          >
            {num} {label}
          </button>
        );
      })}
    </header>
  );
}
