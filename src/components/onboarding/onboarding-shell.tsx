"use client";

import { useState, useEffect } from "react";
import { RotateCcw, SkipForward } from "lucide-react";
import { OnboardingStepArt } from "./onboarding-step-art";
import { OnboardingProgress, type StepDef } from "./onboarding-progress";

const ROTATING_NAMES = ["Thomas", "Pete", "Ridwan", "Donald", "Kitze"];
const BASE = "Hey summon ";
const SHOW_MS = 2000;
const TYPE_CHAR_MS = 55;
const ERASE_CHAR_MS = 35;
const LOCK_DELAY_MS = 60_000;

function useTypingAnimation(expertName: string | null) {
  const [text, setText] = useState(BASE + ROTATING_NAMES[0]);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    // Once an expert name exists, type it out and lock
    if (expertName) {
      setLocked(true);
      let i = 0;
      const typeExpert = () => {
        if (i <= expertName.length) {
          setText(BASE + expertName.slice(0, i));
          i++;
          return setTimeout(typeExpert, TYPE_CHAR_MS);
        }
      };
      // First erase current name, then type expert name
      const currentName = text.slice(BASE.length);
      let eraseIdx = currentName.length;
      const erase = (): ReturnType<typeof setTimeout> => {
        if (eraseIdx > 0) {
          eraseIdx--;
          setText(BASE + currentName.slice(0, eraseIdx));
          return setTimeout(erase, ERASE_CHAR_MS);
        }
        return setTimeout(typeExpert, 150);
      };
      const timer = setTimeout(erase, 200);
      return () => clearTimeout(timer);
    }
  }, [expertName]);

  useEffect(() => {
    if (locked) return;

    let nameIdx = 0;
    let charIdx = ROTATING_NAMES[0].length;
    let phase: "show" | "erase" | "type" = "show";
    let timer: ReturnType<typeof setTimeout>;
    let elapsed = 0;

    const tick = () => {
      // After LOCK_DELAY_MS without an expert name, just stop cycling
      if (elapsed > LOCK_DELAY_MS) {
        setLocked(true);
        return;
      }

      const currentName = ROTATING_NAMES[nameIdx % ROTATING_NAMES.length];
      const nextName = ROTATING_NAMES[(nameIdx + 1) % ROTATING_NAMES.length];

      switch (phase) {
        case "show":
          elapsed += SHOW_MS;
          phase = "erase";
          timer = setTimeout(tick, SHOW_MS);
          break;
        case "erase":
          if (charIdx > 0) {
            charIdx--;
            setText(BASE + currentName.slice(0, charIdx));
            elapsed += ERASE_CHAR_MS;
            timer = setTimeout(tick, ERASE_CHAR_MS);
          } else {
            nameIdx++;
            phase = "type";
            elapsed += 120;
            timer = setTimeout(tick, 120);
          }
          break;
        case "type":
          if (charIdx < nextName.length) {
            charIdx++;
            setText(BASE + nextName.slice(0, charIdx));
            const delay = TYPE_CHAR_MS + Math.random() * 30;
            elapsed += delay;
            timer = setTimeout(tick, delay);
          } else {
            phase = "show";
            timer = setTimeout(tick, 0);
          }
          break;
      }
    };

    timer = setTimeout(tick, SHOW_MS);
    return () => clearTimeout(timer);
  }, [locked]);

  return { text, locked };
}

interface OnboardingShellProps {
  children: React.ReactNode;
  currentStep: number;
  steps: StepDef[];
  expertName: string | null;
  onSkip: () => void;
  onRestart?: () => void;
  showSkip?: boolean;
  sideContent?: React.ReactNode;
}

export function OnboardingShell({
  children,
  currentStep,
  steps,
  expertName,
  onSkip,
  onRestart,
  showSkip = true,
  sideContent,
}: OnboardingShellProps) {
  const { text: typingText, locked } = useTypingAnimation(expertName);
  const totalSteps = steps.length;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left side — wizard */}
      <div className="relative z-10 flex w-full flex-col lg:w-1/2 lg:max-w-2xl">
        {/* Header */}
        <div className="px-6 pt-6 sm:px-10 sm:pt-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/hey-summon.png" alt="HeySummon" className="h-8 w-8" />
              <span className="font-serif text-lg font-semibold text-foreground">
                {typingText}
                {!locked && (
                  <span className="animate-pulse text-muted-foreground/50">
                    |
                  </span>
                )}
              </span>
            </div>
            {showSkip && currentStep < totalSteps - 1 && (
              <div className="flex items-center gap-3">
                {onRestart && currentStep > 0 && (
                  <button
                    onClick={onRestart}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                )}
                <button
                  onClick={onSkip}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SkipForward className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Centered content */}
        <div className="flex flex-1 items-center px-8 py-12 sm:px-20">
          <div className="w-full">
            <div
              key={currentStep}
              className="animate-in fade-in slide-in-from-right-4 duration-300"
            >
              {children}
            </div>
          </div>
        </div>
      
        {/* Progress at the bottom */}
        <div className="px-6 py-4 sm:px-10">
          <OnboardingProgress steps={steps} currentStep={currentStep} />
        </div>
      </div>


      {/* Right side — canvas or contextual content */}
      <div className="hidden lg:block lg:flex-1 relative overflow-hidden">
        {sideContent ?? <OnboardingStepArt step={currentStep} />}
      </div>
    </div>
  );
}
