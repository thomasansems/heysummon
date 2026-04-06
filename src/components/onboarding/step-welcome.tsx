"use client";

import {
  ArrowRight,
  Sparkles,
  CircleX,
  CircleCheck,
  Clock,
  Users,
  Building2,
  Zap,
} from "lucide-react";

interface StepWelcomeProps {
  onNext: () => void;
}

const SCENARIOS = [
  {
    label: "Without HeySummon",
    variant: "before" as const,
    text: "You AI Agent deleted your database.",
  },
  {
    label: "With HeySummon",
    variant: "after" as const,
    text: "Agent asks an expert (you) directly. You answer. I can continue or stop progressing with confidence.",
  },
];

const STEPS = [
  { num: 1, text: "Set up your expert channel", icon: Users },
  { num: 2, text: "Connect an AI assistant", icon: Building2 },
  { num: 3, text: "Test the full round-trip", icon: Zap },
];

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div>
      <h2 className="mb-2 flex items-center gap-2 font-serif text-2xl font-semibold text-foreground">
        <Sparkles className="h-6 w-6 text-white shrink-0" />
        Stop your AI agents from guessing
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        Let your AI assistants ask you questions instead of making assumptions.
      </p>

      {/* Before / After comparison */}
      <div className="mb-6 space-y-2">
        {SCENARIOS.map((s) => (
          <div
            key={s.variant}
            className={`rounded-lg border p-3 ${
              s.variant === "before"
                ? "border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10"
                : "border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-950/10"
            }`}
          >
            <p
              className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-1 ${
                s.variant === "before"
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {s.variant === "before" ? (
                <CircleX className="h-3.5 w-3.5 shrink-0" />
              ) : (
                <CircleCheck className="h-3.5 w-3.5 shrink-0" />
              )}
              {s.label}
            </p>
            <p className="text-sm text-foreground">{s.text}</p>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
        >
          <span className="flex items-center justify-center gap-2">
            Get Started
            <ArrowRight className="h-4 w-4" />
          </span>
        </button>
      </div>
    </div>
  );
}
