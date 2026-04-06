"use client";

import {
  GitPullRequest,
  Heart,
  BookOpen,
  Palette,
  Search,
  Scale,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { ExpertStrength } from "../types";
import { EXPERT_STRENGTH_OPTIONS } from "../types";

const ICON_MAP: Record<string, LucideIcon> = {
  GitPullRequest,
  Heart,
  BookOpen,
  Palette,
  Search,
  Scale,
};

interface ExpertStrengthsStepProps {
  value: ExpertStrength[];
  onChange: (value: ExpertStrength[]) => void;
}

export function ExpertStrengthsStep({
  value,
  onChange,
}: ExpertStrengthsStepProps) {
  const toggleStrength = (strength: ExpertStrength) => {
    if (value.includes(strength)) {
      onChange(value.filter((s) => s !== strength));
    } else {
      onChange([...value, strength]);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Expert strengths
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          What is your expert especially good at? The AI will prefer human input
          for these areas.
        </p>
      </div>
      <div className="space-y-2">
        {EXPERT_STRENGTH_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.icon];
          const isChecked = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleStrength(option.value)}
              className="w-full text-left"
            >
              <Card
                size="sm"
                className={`transition-colors cursor-pointer ${
                  isChecked
                    ? "ring-2 ring-primary bg-primary/5 dark:bg-primary/10"
                    : "hover:ring-primary/40"
                }`}
              >
                <CardContent className="flex items-center gap-3">
                  <Checkbox
                    checked={isChecked}
                    tabIndex={-1}
                    aria-hidden
                  />
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isChecked ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium ${
                        isChecked ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {option.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}
