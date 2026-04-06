"use client";

import { Check, Lock } from "lucide-react";

export interface StepDef {
  label: string;
}

interface OnboardingProgressProps {
  steps: StepDef[];
  currentStep: number;
}

export function OnboardingProgress({
  steps,
  currentStep,
}: OnboardingProgressProps) {
  return (
    <div className="w-full">



      {/* Mobile: compact dots */}
      <div className="flex items-center gap-1.5 mb-4">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div
              key={step.label}
              className={[
                "rounded-full transition-all duration-300",
                isActive
                  ? "h-2 w-5 bg-white/80"
                  : isDone
                    ? "h-2 w-2 bg-white/50 dark:bg-white/30"
                    : "h-2 w-2 bg-muted",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
