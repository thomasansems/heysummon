"use client";

import {
  Zap,
  Scale,
  ShieldCheck,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { AutonomyLevel } from "../types";
import { AUTONOMY_OPTIONS } from "../types";

const ICON_MAP: Record<string, LucideIcon> = {
  Zap,
  Scale,
  ShieldCheck,
  Lock,
};

interface AutonomyStepProps {
  value: AutonomyLevel;
  onChange: (value: AutonomyLevel) => void;
}

export function AutonomyStep({ value, onChange }: AutonomyStepProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          How autonomous should your AI be?
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          This sets the baseline for when your AI summons you.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-1">
        {AUTONOMY_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.icon];
          const isSelected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className="text-left"
            >
              <Card
                size="sm"
                className={`transition-colors cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-primary bg-primary/5 dark:bg-primary/10"
                    : "hover:ring-primary/40"
                }`}
              >
                <CardContent className="flex items-start gap-3">
                  <Icon
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      isSelected ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
