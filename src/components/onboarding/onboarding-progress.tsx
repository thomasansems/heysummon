"use client";

export interface StepDef {
  label: string;
}

interface OnboardingProgressProps {
  steps: StepDef[];
  currentStep: number;
}

export function OnboardingProgress({ steps, currentStep }: OnboardingProgressProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((step, i) => {
        const isDone = i < currentStep;
        const isActive = i === currentStep;

        return (
          <div key={step.label} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                isDone
                  ? "bg-green-600 text-white"
                  : isActive
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
              }`}
              title={step.label}
            >
              {isDone ? "✓" : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-0.5 w-4 sm:w-6 transition-colors ${
                  isDone ? "bg-green-600" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
