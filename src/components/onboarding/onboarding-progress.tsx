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
      {/* Step X of Y — always visible */}
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Step {Math.min(currentStep + 1, steps.length)} of {steps.length}
        <span className="ml-1.5 text-foreground">
          — {steps[Math.min(currentStep, steps.length - 1)].label}
        </span>
      </p>

      {/* Desktop: horizontal stepper with labels */}
      <div className="hidden sm:flex items-center w-full">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;
          const isFuture = i > currentStep;

          return (
            <div key={step.label} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                    isDone
                      ? "bg-green-600 text-white"
                      : isActive
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
                        : "bg-muted text-muted-foreground/50",
                  ].join(" ")}
                >
                  {isDone ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isFuture ? (
                    <Lock className="h-3 w-3" />
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={[
                    "text-[10px] font-medium transition-colors duration-300 whitespace-nowrap",
                    isDone
                      ? "text-green-600 dark:text-green-400"
                      : isActive
                        ? "text-foreground"
                        : "text-muted-foreground/50",
                  ].join(" ")}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="flex-1 mx-1.5 mt-[-14px]">
                  <div
                    className={[
                      "h-0.5 w-full rounded-full transition-colors duration-500",
                      isDone ? "bg-green-600" : "bg-muted",
                    ].join(" ")}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact dots */}
      <div className="flex sm:hidden items-center gap-1.5">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;

          return (
            <div
              key={step.label}
              className={[
                "rounded-full transition-all duration-300",
                isActive
                  ? "h-2 w-5 bg-primary"
                  : isDone
                    ? "h-2 w-2 bg-green-600"
                    : "h-2 w-2 bg-muted",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
