import type { AutonomyLevel, ExpertStrength, SafetyGate, WizardState } from "./types";

const AUTONOMY_DESCRIPTIONS: Record<AutonomyLevel, string> = {
  autonomous:
    "Operate independently. Only summon the expert when completely stuck and unable to proceed.",
  balanced:
    "Work autonomously on routine tasks. Summon the expert for important decisions, ambiguous requirements, or when multiple valid approaches exist.",
  conservative:
    "Summon the expert before taking any risky, unclear, or potentially impactful action. Prefer caution over speed.",
  strict:
    "Summon the expert before most non-trivial actions. Only proceed autonomously on simple, well-defined, low-risk tasks.",
};

const SAFETY_GATE_DESCRIPTIONS: Record<SafetyGate, string> = {
  destructive_actions:
    "Always summon before destructive actions (deleting data, dropping tables, removing files)",
  financial_decisions:
    "Always summon before financial decisions (purchases, billing changes, cost-affecting actions)",
  permission_changes:
    "Always summon before permission changes (modifying access, roles, security settings)",
  external_communications:
    "Always summon before external communications (sending emails, messages, notifications)",
  deployments:
    "Always summon before deployments (deploying to production or staging)",
};

const EXPERT_STRENGTH_DESCRIPTIONS: Record<ExpertStrength, string> = {
  code_review:
    "Prefer human input for code review, architecture decisions, and code quality",
  emotional_intelligence:
    "Prefer human input for sensitive situations requiring empathy",
  domain_expertise:
    "Prefer human input for industry-specific knowledge and context",
  creative_decisions:
    "Prefer human input for design, branding, and creative direction",
  research: "Prefer human input for deep research and investigation tasks",
  legal: "Prefer human input for legal review, compliance, and regulatory matters",
};

function formatAutonomy(level: AutonomyLevel): string {
  return level.charAt(0).toUpperCase() + level.slice(1);
}

export function generateGuidelines(state: WizardState): string {
  const lines: string[] = [];

  lines.push("## Summoning Guidelines");
  lines.push("");
  lines.push(`### Autonomy Level: ${formatAutonomy(state.autonomy)}`);
  lines.push(AUTONOMY_DESCRIPTIONS[state.autonomy]);
  lines.push("");

  if (state.safetyGates.length > 0) {
    lines.push("### Safety Gates (Always Summon)");
    for (const gate of state.safetyGates) {
      lines.push(`- ${SAFETY_GATE_DESCRIPTIONS[gate]}`);
    }
    lines.push("");
  }

  if (state.expertStrengths.length > 0) {
    lines.push("### Expert Strengths (Prefer Human Input)");
    for (const strength of state.expertStrengths) {
      lines.push(`- ${EXPERT_STRENGTH_DESCRIPTIONS[strength]}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
