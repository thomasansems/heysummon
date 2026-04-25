export type ClientChannel =
  | "openclaw"
  | "claudecode"
  | "codex"
  | "gemini"
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

type SkillChannel = Exclude<ClientChannel, "custom">;

/**
 * Multi-line bash block that creates the skill dir and downloads the unified
 * scripts + SKILL.md from /api/v1/skill-scripts/<channel>. Shared by every
 * channel except `custom` so OpenClaw / Claude Code / Codex / Gemini / Cursor
 * all use the same download contract.
 */
function buildScriptDownloadBlock(opts: {
  channel: SkillChannel;
  baseUrl: string;
  skillDir: string;
}): string {
  const { channel, baseUrl, skillDir } = opts;
  return `mkdir -p ${skillDir}/scripts && \\
for f in ask.sh sdk.sh setup.sh add-expert.sh list-experts.sh check-status.sh; do \\
  curl -fsSL "${baseUrl}/api/v1/skill-scripts/${channel}?file=$f" \\
    -o ${skillDir}/scripts/$f && chmod +x ${skillDir}/scripts/$f; \\
done && \\
curl -fsSL "${baseUrl}/api/v1/skill-scripts/${channel}?file=SKILL.md" \\
  -o ${skillDir}/SKILL.md`;
}

/**
 * Compose the .env file body in JS, base64-encode it, and emit a single shell
 * command that decodes it directly into <skillDir>/.env. No values touch the
 * shell during install — multiline summonContext with quotes, backticks, $
 * or backslashes round-trips cleanly. Values inside the file are single-quoted
 * so `set -a; source .env` returns them verbatim.
 */
function buildEnvWriteBlock(opts: {
  skillDir: string;
  baseUrl: string;
  apiKey: string;
  timeout: number;
  pollInterval: number;
  timeoutFallback: string;
  summonContext?: string | null;
}): string {
  const { skillDir, baseUrl, apiKey, timeout, pollInterval, timeoutFallback, summonContext } = opts;
  const lines = [
    `HEYSUMMON_BASE_URL=${shellEscape(baseUrl)}`,
    `HEYSUMMON_API_KEY=${shellEscape(apiKey)}`,
    `HEYSUMMON_TIMEOUT=${shellEscape(String(timeout))}`,
    `HEYSUMMON_POLL_INTERVAL=${shellEscape(String(pollInterval))}`,
    `HEYSUMMON_TIMEOUT_FALLBACK=${shellEscape(timeoutFallback)}`,
  ];
  if (summonContext) {
    lines.push(`HEYSUMMON_SUMMON_CONTEXT=${shellEscape(summonContext)}`);
  }
  const body = lines.join("\n") + "\n";
  const b64 = Buffer.from(body, "utf-8").toString("base64");
  return `printf '%s' '${b64}' | base64 -d > ${skillDir}/.env`;
}

/**
 * Idempotency guard prefixed onto every skill-channel install.
 *  - Same HEYSUMMON_API_KEY already present -> exit 0 (no-op).
 *  - Different key -> exit 1 unless HEYSUMMON_FORCE=1.
 * Sourcing the .env in a subshell parses single-quoted values via bash itself,
 * matching exactly how the runtime scripts read them.
 */
function buildGuardPreamble(opts: { skillDir: string; apiKey: string }): string {
  const { skillDir, apiKey } = opts;
  const envPath = shellEscape(`${skillDir}/.env`);
  const safeKey = shellEscape(apiKey);
  return `if [ -f ${envPath} ]; then
  existing=$( (set -a; . ${envPath}; printf '%s' "$HEYSUMMON_API_KEY") 2>/dev/null || printf '' )
  if [ "$existing" = ${safeKey} ]; then
    echo "HeySummon already configured at ${skillDir}/.env — nothing to do."
    exit 0
  fi
  if [ "\${HEYSUMMON_FORCE:-}" != "1" ]; then
    echo "Refusing to overwrite existing HeySummon install at ${skillDir}/.env (different apiKey)." >&2
    echo "To replace, re-run with HEYSUMMON_FORCE=1." >&2
    exit 1
  fi
fi`;
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
  const {
    channel,
    skillDir,
    baseUrl,
    apiKey,
    timeout,
    pollInterval,
    timeoutFallback,
    globalInstall,
    expertName,
    summonContext,
  } = opts;
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
  -d "{\\"apiKey\\":\\"$HEYSUMMON_API_KEY\\",\\"question\\":\\"Ask your expert something\\"}"

# TypeScript / JavaScript runtimes: install the SDK (recommended):
#   npm install @heysummon/consumer-sdk`;
  }

  const guard = buildGuardPreamble({ skillDir, apiKey });
  const downloadBlock = buildScriptDownloadBlock({ channel, baseUrl, skillDir });
  const envWrite = buildEnvWriteBlock({
    skillDir,
    baseUrl,
    apiKey,
    timeout,
    pollInterval,
    timeoutFallback: timeoutFallback || "proceed_cautiously",
    summonContext,
  });
  const npmFlag = globalInstall ? " -g" : "";
  const safeKey = shellEscape(apiKey);

  if (channel === "openclaw") {
    return `${guard}
npm install${npmFlag} @heysummon/consumer-sdk && \\
${downloadBlock} && \\
${envWrite} && \\
HEYSUMMON_BASE_URL=${shellEscape(baseUrl)} bash ${skillDir}/scripts/add-expert.sh ${safeKey} ${safeName} && \\
echo "Verifying connection..." && \\
curl -sf "${baseUrl}/api/v1/whoami" \\
  -H "x-api-key: ${apiKey}" > /dev/null && \\
echo "HeySummon skill installed and connected successfully."`;
  }

  return `${guard}
npm install${npmFlag} @heysummon/consumer-sdk && \\
${downloadBlock} && \\
${envWrite} && \\
echo "Verifying connection..." && \\
curl -sf "${baseUrl}/api/v1/whoami" \\
  -H "x-api-key: ${apiKey}" > /dev/null && \\
echo "HeySummon skill installed and connected successfully."`;
}
