/**
 * Build the text that gets copied to clipboard when the user clicks "Copy"
 * on the setup instructions in the onboarding wizard or dashboard.
 *
 * This text is designed to be pasted into Claude Code (or other AI agents).
 * It includes explicit step-by-step instructions that AI agents can follow.
 */
export function buildSetupCopyText(
  setupUrl: string,
  summonContext: string,
): string {
  const commandUrl = setupUrl.replace("/setup/", "/api/v1/setup/") + "/command";

  const lines: string[] = [];
  lines.push("HeySummon Setup");
  lines.push("---");
  lines.push("Connect this AI agent to a human expert via HeySummon.");
  lines.push("");

  if (summonContext.trim()) {
    lines.push("IMPORTANT — SUMMONING GUIDELINES (save to memory):");
    lines.push("The following guidelines define when and how to summon your human expert.");
    lines.push("You MUST save these to your persistent memory before proceeding with any work.");
    lines.push("These rules take priority over default autonomy settings.");
    lines.push("");
    lines.push(summonContext.trim());
    lines.push("");
  }

  lines.push("INSTALLATION (Claude Code):");
  lines.push("");
  lines.push("Step 1. Add the HeySummon marketplace (one-time):");
  lines.push("  /plugin marketplace add thomasansems/heysummon");
  lines.push("");
  lines.push("Step 2. Install the plugin (one-time):");
  lines.push("  /plugin install heysummon@client");
  lines.push("");
  lines.push("Step 3. Configure with your setup link:");
  lines.push(`  /heysummon:setup ${setupUrl}`);
  lines.push("");
  lines.push("ALTERNATIVE (any terminal):");
  lines.push(`  curl -sf "${commandUrl}" | jq -r '.installCommand' | bash`);
  lines.push("");
  lines.push(`Setup link (valid 24 hours): ${setupUrl}`);

  return lines.join("\n");
}
