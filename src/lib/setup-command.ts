export type ClientChannel =
  | "openclaw"
  | "claudecode"
  | "codex"
  | "gemini"
  | "cursor"
  | "custom";

export interface PlatformMeta {
  label: string;
  subtitle?: string;
  skillDir: string;
}

export const PLATFORM_META: Record<string, PlatformMeta> = {
  openclaw: { label: "OpenClaw", skillDir: "skills/heysummon" },
  claudecode: { label: "Claude Code", skillDir: ".claude/skills/heysummon" },
  codex: { label: "Codex CLI", skillDir: ".codex/skills/heysummon" },
  gemini: { label: "Gemini CLI", skillDir: ".gemini/skills/heysummon" },
  cursor: { label: "Cursor", skillDir: ".cursor/skills/heysummon" },
  custom: {
    label: "Custom",
    subtitle: "API-only — any runtime",
    skillDir: "",
  },
};

/** Wrap a string in single quotes for safe shell interpolation */
export function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

export function buildInstallCommand(opts: {
  channel: ClientChannel;
  skillDir: string;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  pollInterval: number;
  timeoutFallback?: string;
  globalInstall: boolean;
  expertName: string;
  summonContext?: string | null;
}): string {
  const { channel, skillDir, baseUrl, apiKey, timeout, pollInterval, timeoutFallback, globalInstall, expertName, summonContext } = opts;
  const safeName = shellEscape(expertName);

  if (channel === "custom") {
    const safeContext = summonContext ? shellEscape(summonContext) : null;
    const contextLine = safeContext ? `\nexport HEYSUMMON_SUMMON_CONTEXT=${safeContext}` : "";
    return `# HeySummon — generic HTTP recipe (works with any runtime)
export HEYSUMMON_BASE_URL="${baseUrl}"
export HEYSUMMON_API_KEY="${apiKey}"${contextLine}

# Submit a help request. End-to-end encryption keys (signPublicKey / encryptPublicKey)
# are required — the @heysummon/consumer-sdk handles key generation, encryption, and
# polling for you. For raw HTTP, see ${baseUrl}/clients/custom for the full payload shape.
curl -sS -X POST "$HEYSUMMON_BASE_URL/api/v1/help" \\
  -H "Content-Type: application/json" \\
  -d "{\\"apiKey\\":\\"$HEYSUMMON_API_KEY\\",\\"question\\":\\"Ask ${expertName} something\\"}"

# TypeScript / JavaScript runtimes: install the SDK (recommended):
#   npm install @heysummon/consumer-sdk`;
  }

  if (channel === "openclaw") {
    const envPrefix = summonContext
      ? `HEYSUMMON_BASE_URL="${baseUrl}" HEYSUMMON_SUMMON_CONTEXT=${shellEscape(summonContext)} `
      : `HEYSUMMON_BASE_URL="${baseUrl}" `;
    return `cd ~/clawd && ${envPrefix}bash skills/heysummon/scripts/add-expert.sh ${apiKey} ${safeName}`;
  }

  const npmFlag = globalInstall ? " -g" : "";
  const contextLine = summonContext ? `\nHEYSUMMON_SUMMON_CONTEXT="${summonContext}"` : "";
  return `npm install${npmFlag} @heysummon/consumer-sdk && \\
mkdir -p ${skillDir}/scripts && \\
for f in ask.sh sdk.sh setup.sh add-expert.sh list-experts.sh check-status.sh; do \\
  curl -fsSL "${baseUrl}/api/v1/skill-scripts/${channel}?file=$f" \\
    -o ${skillDir}/scripts/$f && chmod +x ${skillDir}/scripts/$f; \\
done && \\
curl -fsSL "${baseUrl}/api/v1/skill-scripts/${channel}?file=SKILL.md" \\
  -o ${skillDir}/SKILL.md && \\
cat > ${skillDir}/.env << 'EOF'
HEYSUMMON_BASE_URL=${baseUrl}
HEYSUMMON_API_KEY=${apiKey}
HEYSUMMON_TIMEOUT=${timeout}
HEYSUMMON_POLL_INTERVAL=${pollInterval}
HEYSUMMON_TIMEOUT_FALLBACK=${timeoutFallback || "proceed_cautiously"}${contextLine}
EOF
echo "Verifying connection..." && \\
curl -sf "${baseUrl}/api/v1/whoami" \\
  -H "x-api-key: ${apiKey}" > /dev/null && \\
echo "HeySummon skill installed and connected successfully."`;
}
