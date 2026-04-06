"use client";

import { Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import type { BudgetFrequency } from "../types";
import { BUDGET_AWARENESS_OPTIONS, RESPONSE_TIME_OPTIONS } from "../types";

interface BudgetFrequencyStepProps {
  value: BudgetFrequency;
  onChange: (value: BudgetFrequency) => void;
}

export function BudgetFrequencyStep({
  value,
  onChange,
}: BudgetFrequencyStepProps) {
  const isUnlimited = value.maxSummonsPerDay === null;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-foreground">
          Budget & frequency
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Control how often and how urgently the AI can summon you.
        </p>
      </div>

      {/* Max summons per day */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Gauge className="h-3.5 w-3.5" />
            Max summons per day
          </label>
          <span className="text-xs font-medium text-foreground">
            {isUnlimited ? "Unlimited" : value.maxSummonsPerDay}
          </span>
        </div>
        <Slider
          min={1}
          max={20}
          value={isUnlimited ? [10] : [value.maxSummonsPerDay!]}
          disabled={isUnlimited}
          onValueChange={(vals) => {
            const v = Array.isArray(vals) ? vals[0] : vals;
            onChange({ ...value, maxSummonsPerDay: v });
          }}
        />
        <div className="flex items-center gap-2">
          <Checkbox
            checked={isUnlimited}
            onCheckedChange={(checked) =>
              onChange({
                ...value,
                maxSummonsPerDay: checked ? null : 10,
              })
            }
            aria-label="Unlimited summons"
          />
          <span className="text-xs text-muted-foreground">Unlimited</span>
        </div>
      </div>

      {/* Budget awareness */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Budget awareness
        </label>
        <div className="grid grid-cols-3 gap-2">
          {BUDGET_AWARENESS_OPTIONS.map((option) => {
            const isSelected = value.budgetAwareness === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({ ...value, budgetAwareness: option.value })
                }
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
                  <CardContent>
                    <p
                      className={`text-xs font-medium ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {option.description}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>

      {/* Response time expectation */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          Expected response time
        </label>
        <div className="grid grid-cols-3 gap-2">
          {RESPONSE_TIME_OPTIONS.map((option) => {
            const isSelected =
              value.responseTimeExpectation === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  onChange({
                    ...value,
                    responseTimeExpectation: option.value,
                  })
                }
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
                  <CardContent>
                    <p
                      className={`text-xs font-medium ${
                        isSelected ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {option.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {option.description}
                    </p>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
