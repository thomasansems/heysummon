"use client";

import { useEffect } from "react";
import { Loader2, Check, Building2, Copy, RefreshCw, SkipForward } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useState } from "react";
import { useConnectionVerify } from "@/hooks/use-connection-verify";
import type { ClientChannelType, ClientSubChannelType } from "@/components/shared/client-channel-selector";

const PLATFORM_META: Record<string, { label: string; skillDir: string }> = {
  openclaw: { label: "OpenClaw", skillDir: "skills/heysummon" },
  claudecode: { label: "Claude Code", skillDir: ".claude/skills/heysummon" },
  codex: { label: "Codex CLI", skillDir: ".codex/skills/heysummon" },
  gemini: { label: "Gemini CLI", skillDir: ".gemini/skills/heysummon" },
  cursor: { label: "Cursor", skillDir: ".cursor/skills/heysummon" },
};

interface StepVerifyClientProps {
  keyId: string;
  apiKey: string;
  setupUrl: string;
  channel: ClientChannelType;
  subChannel: ClientSubChannelType | null;
  baseUrl: string;
  timeout: number;
  pollInterval: number;
  onVerified: () => void;
}

export function StepVerifyClient({
  keyId,
  apiKey,
  setupUrl,
  channel,
  baseUrl,
  timeout,
  pollInterval,
  onVerified,
}: StepVerifyClientProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const meta = PLATFORM_META[channel] ?? PLATFORM_META.claudecode;
  const isSkillBased = channel !== "openclaw";
  const { status, elapsed, start, retry } = useConnectionVerify({
    keyId,
    timeoutMs: 120_000,
  });

  useEffect(() => {
    start();
  }, [start]);

  useEffect(() => {
    if (status === "connected") {
      const timer = setTimeout(onVerified, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onVerified]);

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const skillDir = meta.skillDir;
  const installCmd = isSkillBased
    ? `npm install -g @heysummon/consumer-sdk && \\
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
EOF
echo "Verifying connection..." && \\
curl -sf "${baseUrl}/api/v1/whoami" \\
  -H "x-api-key: ${apiKey}" > /dev/null && \\
echo "Connected and device bound successfully."`
    : "";

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Building2 className="h-5 w-5 shrink-0" />
        Connect Your Client
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        {isSkillBased
          ? `Run the setup command for ${meta.label}.`
          : "Open the setup link to connect."}
      </p>

      {isSkillBased ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-black p-4">
            <p className="mb-2 text-xs text-muted-foreground font-medium">
              Run this in your project directory:
            </p>
            <div className="relative">
              <pre className="text-xs text-green-400 whitespace-pre-wrap break-all overflow-x-auto">
                {installCmd}
              </pre>
              <button
                onClick={() => handleCopy(installCmd)}
                className="absolute right-2 top-1 text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
              >
                {copied === installCmd ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-black p-4">
            <p className="mb-2 text-xs text-muted-foreground font-medium">Setup link:</p>
            <div className="flex items-start gap-2">
              <code className="text-xs text-green-400 break-all flex-1">
                {setupUrl}
              </code>
              <button
                onClick={() => handleCopy(setupUrl)}
                className="shrink-0 text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
              >
                {copied === setupUrl ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Open this link to connect. Detection is automatic.
          </p>
        </div>
      )}

      {/* Connection status */}
      <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
        {status === "checking" && (
          <>
            <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
            <div>
              <p className="text-sm text-foreground">
                Waiting for connection... ({elapsed}s)
              </p>
              <p className="text-xs text-muted-foreground">
                Run the command above to connect
              </p>
            </div>
          </>
        )}
        {status === "connected" && (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0">
              <Check className="h-4 w-4 text-white" />
            </div>
            <p className="text-sm font-medium text-green-600 dark:text-green-400">
              Client connected!
            </p>
          </>
        )}
        {status === "timeout" && (
          <>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
              <span className="text-white text-sm">!</span>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                Connection timed out
              </p>
              <p className="text-xs text-muted-foreground">
                Check that the install command completed
              </p>
            </div>
          </>
        )}
      </div>

      {status === "timeout" && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={retry}
            className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
          >
            <span className="flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Try again
            </span>
          </button>
          <button
            onClick={onVerified}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-1.5">
              <SkipForward className="h-3.5 w-3.5" />
              Skip verification
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
