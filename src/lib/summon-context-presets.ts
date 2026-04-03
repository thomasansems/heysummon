export const SUMMON_CONTEXT_PRESETS = [
  {
    label: "Strict",
    text: "Only summon when the AI is completely stuck and cannot proceed without human input. Do not summon for style preferences or minor decisions.",
  },
  {
    label: "Budget-conscious",
    text: "Summon only for decisions that could cost money or affect billing. Proceed autonomously on all other tasks.",
  },
  {
    label: "Safety-first",
    text: "Summon before any destructive action (deleting data, modifying production, changing permissions). Proceed autonomously for read-only and development tasks.",
  },
];
