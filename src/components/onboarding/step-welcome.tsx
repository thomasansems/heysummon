"use client";

import { ArrowRight } from "lucide-react";

interface StepWelcomeProps {
  onNext: () => void;
}

const SCENARIOS = [
  {
    label: "Without HeySummon",
    variant: "before" as const,
    text: "Your AI agent hits an ambiguous requirement. It guesses, builds the wrong thing. You find out during code review, 2 hours later.",
  },
  {
    label: "With HeySummon",
    variant: "after" as const,
    text: "Your agent asks you directly. You answer in 30 seconds via Telegram. It builds the right thing on the first try.",
  },
];

const STEPS = [
  { num: 1, text: "Set up your provider channel" },
  { num: 2, text: "Connect an AI assistant" },
  { num: 3, text: "Test the full round-trip" },
];

export function StepWelcome({ onNext }: StepWelcomeProps) {
  return (
    <div>
      <h2 className="mb-2 font-serif text-2xl font-semibold text-foreground">
        Your AI agents are only as good as the answers they get
      </h2>
      <p className="mb-6 text-sm text-muted-foreground">
        HeySummon connects your AI coding assistants to you — the human expert —
        so they can ask questions and get real answers instead of guessing.
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
              className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                s.variant === "before"
                  ? "text-red-600 dark:text-red-400"
                  : "text-green-600 dark:text-green-400"
              }`}
            >
              {s.label}
            </p>
            <p className="text-sm text-foreground">{s.text}</p>
          </div>
        ))}
      </div>

      {/* Timeout concern — addressed directly */}
      <div className="mb-6 rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-sm text-foreground mb-1 font-medium">
          What if I can&apos;t respond immediately?
        </p>
        <p className="text-xs text-muted-foreground">
          You set the timeout (default 15 min). Your agent moves on to other
          work and picks up your answer whenever it arrives. No blocked
          workflows, no wasted time.
        </p>
      </div>

      {/* Compact step overview */}
      <div className="mb-6 flex items-center justify-between gap-2 px-1">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {step.num}
              </span>
              <span className="text-xs text-muted-foreground">{step.text}</span>
            </div>
            {i < STEPS.length - 1 && (
              <ArrowRight className="h-3 w-3 text-muted-foreground/40 shrink-0" />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
      >
        Get Started
      </button>
    </div>
  );
}
