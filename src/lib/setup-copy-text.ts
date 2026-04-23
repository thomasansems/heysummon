import { type ClientChannel, PLATFORM_META } from "@/lib/setup-command";

/**
 * Build the text that gets copied to clipboard when the user clicks "Copy"
 * on the setup instructions in the onboarding wizard or dashboard.
 *
 * This text is designed to be pasted into the AI agent. It includes
 * platform-specific step-by-step instructions the agent can follow.
 */
export function buildSetupCopyText(
  setupUrl: string,
  summonContext: string,
  channel: ClientChannel = "claudecode",
): string {
  const commandUrl = setupUrl.replace("/setup/", "/api/v1/setup/") + "/command";
  const meta = PLATFORM_META[channel] ?? PLATFORM_META.claudecode;

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

  if (channel === "claudecode") {
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
  } else if (channel === "openclaw") {
    lines.push("INSTALLATION (OpenClaw):");
    lines.push("");
    lines.push("Step 1. Install the HeySummon skill (one-time):");
    lines.push("  npx clawhub@latest install heysummon");
    lines.push("");
    lines.push("Step 2. Run the setup command:");
    lines.push(`  curl -sf "${commandUrl}" | jq -r '.installCommand' | bash`);
  } else if (channel === "custom") {
    lines.push("INSTALLATION (Custom — any runtime):");
    lines.push("");
    lines.push("HeySummon has no runtime-specific skill for this client. Integrate with the");
    lines.push("HTTP API directly, or use the TypeScript / JavaScript SDK.");
    lines.push("");
    lines.push("Step 1. Fetch the generic recipe (env vars + sample request):");
    lines.push(`  curl -sf "${commandUrl}" | jq -r '.installCommand'`);
    lines.push("");
    lines.push("Step 2. For TypeScript / JavaScript runtimes, install the SDK:");
    lines.push("  npm install @heysummon/consumer-sdk");
    lines.push("");
    lines.push("The SDK handles key generation, end-to-end encryption, and polling for you.");
  } else {
    lines.push(`INSTALLATION (${meta.label}):`);
    lines.push("");
    lines.push("Run this in your project directory:");
    lines.push(`  curl -sf "${commandUrl}" | jq -r '.installCommand' | bash`);
    lines.push("");
    lines.push(`This installs the HeySummon skill to ${meta.skillDir} and configures the connection.`);
  }

  lines.push("");
  lines.push(`Setup link (valid 24 hours): ${setupUrl}`);

  return lines.join("\n");
}
