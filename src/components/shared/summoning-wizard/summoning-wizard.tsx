"use client";

import { useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  SkipForward,
  Check,
} from "lucide-react";
import type { WizardState } from "./types";
import { DEFAULT_WIZARD_STATE } from "./types";
import { generateGuidelines } from "./generate-guidelines";
import { AutonomyStep } from "./steps/autonomy-step";
import { SafetyGatesStep } from "./steps/safety-gates-step";
import { ExpertStrengthsStep } from "./steps/expert-strengths-step";
import { BudgetFrequencyStep } from "./steps/budget-frequency-step";
import { ReviewExportStep } from "./steps/review-export-step";

const STEP_LABELS = [
  "Autonomy",
  "Safety gates",
  "Expert strengths",
  "Frequency",
  "Review",
];

const CHAR_LIMIT = 2000;

interface SummoningWizardProps {
  initialState?: WizardState;
  onComplete: (text: string, state: WizardState) => void;
  onSkip?: () => void;
  compact?: boolean;
}

export function SummoningWizard({
  initialState,
  onComplete,
  onSkip,
  compact,
}: SummoningWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [state, setState] = useState<WizardState>(
    initialState ?? DEFAULT_WIZARD_STATE,
  );

  const generatedText = useMemo(() => generateGuidelines(state), [state]);

  const totalSteps = STEP_LABELS.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete(generatedText, state);
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStep((s) => s - 1);
    }
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      const defaultText = generateGuidelines(DEFAULT_WIZARD_STATE);
      onComplete(defaultText, DEFAULT_WIZARD_STATE);
    }
  };

  return (
    <div className={`space-y-4 ${compact ? "text-sm" : ""}`}>
      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                i === currentStep
                  ? "bg-primary text-primary-foreground"
                  : i < currentStep
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < currentStep ? (
                <Check className="h-3 w-3" />
              ) : (
                <span>{i + 1}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </button>
            {i < totalSteps - 1 && (
              <div
                className={`h-px w-3 ${
                  i < currentStep ? "bg-primary" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="animate-in fade-in duration-200">
        {currentStep === 0 && (
          <AutonomyStep
            value={state.autonomy}
            onChange={(autonomy) => setState((s) => ({ ...s, autonomy }))}
          />
        )}
        {currentStep === 1 && (
          <SafetyGatesStep
            value={state.safetyGates}
            onChange={(safetyGates) => setState((s) => ({ ...s, safetyGates }))}
          />
        )}
        {currentStep === 2 && (
          <ExpertStrengthsStep
            value={state.expertStrengths}
            onChange={(expertStrengths) =>
              setState((s) => ({ ...s, expertStrengths }))
            }
          />
        )}
        {currentStep === 3 && (
          <BudgetFrequencyStep
            value={state.budgetFrequency}
            onChange={(budgetFrequency) =>
              setState((s) => ({ ...s, budgetFrequency }))
            }
          />
        )}
        {currentStep === 4 && (
          <ReviewExportStep
            generatedText={generatedText}
            charLimit={CHAR_LIMIT}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {!isFirstStep && (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
          )}
          {onSkip && (
            <button
              type="button"
              onClick={handleSkip}
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <SkipForward className="h-3.5 w-3.5" />
              Skip
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          {isLastStep ? (
            <>
              <Check className="h-4 w-4" />
              Save
            </>
          ) : (
            <>
              Next
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
