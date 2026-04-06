import { describe, it, expect } from "vitest";
import { generateGuidelines } from "./generate-guidelines";
import type { WizardState } from "./types";
import { DEFAULT_WIZARD_STATE } from "./types";

describe("generateGuidelines", () => {
  it("generates valid text from default state", () => {
    const text = generateGuidelines(DEFAULT_WIZARD_STATE);
    expect(text).toContain("## Summoning Guidelines");
    expect(text).toContain("### Autonomy Level: Balanced");
    expect(text).toContain("### Safety Gates (Always Summon)");
    expect(text).toContain("destructive actions");
    expect(text).toContain("financial decisions");
    expect(text).toContain("### Frequency");
    expect(text).toContain("no daily limit");
    expect(text).toContain("Budget awareness: medium");
  });

  it("generates correct text for autonomous level", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      autonomy: "autonomous",
    };
    const text = generateGuidelines(state);
    expect(text).toContain("### Autonomy Level: Autonomous");
    expect(text).toContain("Only summon the expert when completely stuck");
  });

  it("generates correct text for conservative level", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      autonomy: "conservative",
    };
    const text = generateGuidelines(state);
    expect(text).toContain("### Autonomy Level: Conservative");
    expect(text).toContain("risky, unclear, or potentially impactful");
  });

  it("generates correct text for strict level", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      autonomy: "strict",
    };
    const text = generateGuidelines(state);
    expect(text).toContain("### Autonomy Level: Strict");
    expect(text).toContain("most non-trivial actions");
  });

  it("omits safety gates section when empty", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      safetyGates: [],
    };
    const text = generateGuidelines(state);
    expect(text).not.toContain("### Safety Gates");
  });

  it("includes all selected safety gates", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      safetyGates: [
        "destructive_actions",
        "financial_decisions",
        "permission_changes",
        "external_communications",
        "deployments",
      ],
    };
    const text = generateGuidelines(state);
    expect(text).toContain("destructive actions");
    expect(text).toContain("financial decisions");
    expect(text).toContain("permission changes");
    expect(text).toContain("external communications");
    expect(text).toContain("deployments");
  });

  it("omits expert strengths section when empty", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      expertStrengths: [],
    };
    const text = generateGuidelines(state);
    expect(text).not.toContain("### Expert Strengths");
  });

  it("includes selected expert strengths", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      expertStrengths: ["code_review", "legal"],
    };
    const text = generateGuidelines(state);
    expect(text).toContain("### Expert Strengths");
    expect(text).toContain("code review");
    expect(text).toContain("legal review");
  });

  it("handles specific max summons per day", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      budgetFrequency: {
        maxSummonsPerDay: 5,
        budgetAwareness: "high",
        responseTimeExpectation: "hours",
      },
    };
    const text = generateGuidelines(state);
    expect(text).toContain("up to 5 summons per day");
    expect(text).toContain("Budget awareness: high");
    expect(text).toContain("within a few hours");
  });

  it("handles unlimited summons", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      budgetFrequency: {
        maxSummonsPerDay: null,
        budgetAwareness: "low",
        responseTimeExpectation: "minutes",
      },
    };
    const text = generateGuidelines(state);
    expect(text).toContain("no daily limit");
    expect(text).toContain("within minutes");
  });

  it("handles async response time", () => {
    const state: WizardState = {
      ...DEFAULT_WIZARD_STATE,
      budgetFrequency: {
        ...DEFAULT_WIZARD_STATE.budgetFrequency,
        responseTimeExpectation: "async",
      },
    };
    const text = generateGuidelines(state);
    expect(text).toContain("asynchronously (when available)");
  });

  it("stays under 2000 chars with maximum selections", () => {
    const state: WizardState = {
      autonomy: "strict",
      safetyGates: [
        "destructive_actions",
        "financial_decisions",
        "permission_changes",
        "external_communications",
        "deployments",
      ],
      expertStrengths: [
        "code_review",
        "emotional_intelligence",
        "domain_expertise",
        "creative_decisions",
        "research",
        "legal",
      ],
      budgetFrequency: {
        maxSummonsPerDay: 20,
        budgetAwareness: "high",
        responseTimeExpectation: "async",
      },
    };
    const text = generateGuidelines(state);
    expect(text.length).toBeLessThanOrEqual(2000);
  });
});
