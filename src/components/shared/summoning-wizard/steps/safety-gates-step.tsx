"use client";

import {
  Trash2,
  DollarSign,
  KeyRound,
  Mail,
  Rocket,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { SafetyGate } from "../types";
import { SAFETY_GATE_OPTIONS } from "../types";

const ICON_MAP: Record<string, LucideIcon> = {
  Trash2,
  DollarSign,
  KeyRound,
  Mail,
  Rocket,
};

interface SafetyGatesStepProps {
  value: SafetyGate[];
  onChange: (value: SafetyGate[]) => void;
}

export function SafetyGatesStep({ value, onChange }: SafetyGatesStepProps) {
  const toggleGate = (gate: SafetyGate) => {
    if (value.includes(gate)) {
      onChange(value.filter((g) => g !== gate));
    } else {
      onChange([...value, gate]);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Safety gates
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Always summon you before these actions, regardless of autonomy level.
        </p>
      </div>
      <div className="space-y-2">
        {SAFETY_GATE_OPTIONS.map((option) => {
          const Icon = ICON_MAP[option.icon];
          const isChecked = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => toggleGate(option.value)}
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
