export type AutonomyLevel = "autonomous" | "balanced" | "conservative" | "strict";

export type SafetyGate =
  | "destructive_actions"
  | "financial_decisions"
  | "permission_changes"
  | "external_communications"
  | "deployments";

export type ExpertStrength =
  | "code_review"
  | "emotional_intelligence"
  | "domain_expertise"
  | "creative_decisions"
  | "research"
  | "legal";

export interface BudgetFrequency {
  maxSummonsPerDay: number | null;
  budgetAwareness: "low" | "medium" | "high";
  responseTimeExpectation: "minutes" | "hours" | "async";
}

export interface WizardState {
  autonomy: AutonomyLevel;
  safetyGates: SafetyGate[];
  expertStrengths: ExpertStrength[];
  budgetFrequency: BudgetFrequency;
}

export const DEFAULT_WIZARD_STATE: WizardState = {
  autonomy: "balanced",
  safetyGates: ["destructive_actions", "financial_decisions"],
  expertStrengths: [],
  budgetFrequency: {
    maxSummonsPerDay: null,
    budgetAwareness: "medium",
    responseTimeExpectation: "minutes",
  },
};

export const AUTONOMY_OPTIONS: {
  value: AutonomyLevel;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "autonomous",
    label: "Autonomous",
    description: "Summon only when completely stuck",
    icon: "Zap",
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Summon for important decisions",
    icon: "Scale",
  },
  {
    value: "conservative",
    label: "Conservative",
    description: "Summon before risky or unclear actions",
    icon: "ShieldCheck",
  },
  {
    value: "strict",
    label: "Strict",
    description: "Summon before most non-trivial actions",
    icon: "Lock",
  },
];

export const SAFETY_GATE_OPTIONS: {
  value: SafetyGate;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "destructive_actions",
    label: "Destructive actions",
    description: "Deleting data, dropping tables, removing files",
    icon: "Trash2",
  },
  {
    value: "financial_decisions",
    label: "Financial decisions",
    description: "Purchases, billing changes, cost-affecting actions",
    icon: "DollarSign",
  },
  {
    value: "permission_changes",
    label: "Permission changes",
    description: "Modifying access, roles, or security settings",
    icon: "KeyRound",
  },
  {
    value: "external_communications",
    label: "External communications",
    description: "Sending emails, messages, or notifications",
    icon: "Mail",
  },
  {
    value: "deployments",
    label: "Deployments",
    description: "Deploying to production or staging environments",
    icon: "Rocket",
  },
];

export const EXPERT_STRENGTH_OPTIONS: {
  value: ExpertStrength;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "code_review",
    label: "Code review",
    description: "Architecture decisions and code quality",
    icon: "GitPullRequest",
  },
  {
    value: "emotional_intelligence",
    label: "Emotional intelligence",
    description: "Sensitive situations requiring empathy",
    icon: "Heart",
  },
  {
    value: "domain_expertise",
    label: "Domain expertise",
    description: "Industry-specific knowledge and context",
    icon: "BookOpen",
  },
  {
    value: "creative_decisions",
    label: "Creative decisions",
    description: "Design, branding, and creative direction",
    icon: "Palette",
  },
  {
    value: "research",
    label: "Research",
    description: "Deep research and investigation tasks",
    icon: "Search",
  },
  {
    value: "legal",
    label: "Legal & compliance",
    description: "Legal review, compliance, and regulatory",
    icon: "Scale",
  },
];

export const BUDGET_AWARENESS_OPTIONS: {
  value: BudgetFrequency["budgetAwareness"];
  label: string;
  description: string;
}[] = [
  {
    value: "low",
    label: "Low",
    description: "Summon freely, cost is not a concern",
  },
  {
    value: "medium",
    label: "Medium",
    description: "Be mindful of summon frequency",
  },
  {
    value: "high",
    label: "High",
    description: "Minimize summons, batch questions",
  },
];

export const RESPONSE_TIME_OPTIONS: {
  value: BudgetFrequency["responseTimeExpectation"];
  label: string;
  description: string;
}[] = [
  {
    value: "minutes",
    label: "Minutes",
    description: "Expert is actively available",
  },
  {
    value: "hours",
    label: "Hours",
    description: "Expert checks periodically",
  },
  {
    value: "async",
    label: "Async",
    description: "Expert responds when available",
  },
];
