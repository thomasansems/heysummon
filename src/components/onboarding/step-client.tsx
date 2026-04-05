"use client";

import { useState, useEffect } from "react";
import { Loader2, Check, ChevronDown, ChevronRight } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useConnectionVerify } from "@/hooks/use-connection-verify";
import {
  ClientChannelSelector,
  type ClientChannelType,
  type ClientSubChannelType,
} from "@/components/shared/client-channel-selector";
import { SUMMON_CONTEXT_PRESETS } from "@/lib/summon-context-presets";

const DEFAULT_TIMEOUT = 900;
const DEFAULT_POLL_INTERVAL = 3;
const MAX_RECENT_SHOWN = 5;

const TIMEOUT_PRESETS = [
  { value: 300, label: "5 min", desc: "You're actively available" },
  { value: 900, label: "15 min", desc: "Checking your phone regularly" },
  { value: 1800, label: "30 min", desc: "In meetings, checking between" },
  { value: -1, label: "Custom", desc: "" },
];

const PLATFORM_META: Record<string, { label: string; skillDir: string }> = {
  openclaw: { label: "OpenClaw", skillDir: "skills/heysummon" },
  claudecode: { label: "Claude Code", skillDir: ".claude/skills/heysummon" },
  codex: { label: "Codex CLI", skillDir: ".codex/skills/heysummon" },
  gemini: { label: "Gemini CLI", skillDir: ".gemini/skills/heysummon" },
  cursor: { label: "Cursor", skillDir: ".cursor/skills/heysummon" },
};

type Phase = "channel" | "details" | "creating" | "connecting";

interface StepClientProps {
  expertId: string;
  expertName: string;
  baseUrl: string;
  onComplete: (data: {
    keyId: string;
    apiKey: string;
    channel: ClientChannelType;
    subChannel: ClientSubChannelType | null;
    clientName: string;
  }) => void;
}

export function StepClient({
  expertId,
  expertName,
  baseUrl,
  onComplete,
}: StepClientProps) {
  const [phase, setPhase] = useState<Phase>("channel");
  const [channel, setChannel] = useState<ClientChannelType | null>(null);
  const [subChannel, setSubChannel] = useState<ClientSubChannelType | null>(null);
  const [name, setName] = useState("");
  const [timeout, setTimeout_] = useState(DEFAULT_TIMEOUT);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const [customTimeout, setCustomTimeout] = useState<number | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [summonContext, setSummonContext] = useState("");
  const [recentContexts, setRecentContexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Created client data
  const [keyId, setKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const meta = channel ? PLATFORM_META[channel] ?? PLATFORM_META.claudecode : null;
  const isSkillBased = channel !== "openclaw";

  const { status: verifyStatus, elapsed, start, retry } = useConnectionVerify({
    keyId: keyId || "noop",
    timeoutMs: 120_000,
  });

  // Fetch recently used contexts from expert
  useEffect(() => {
    const fetchRecent = async () => {
      const res = await fetch(`/api/experts/${expertId}`);
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.expert?.recentSummonContexts;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) setRecentContexts(parsed);
        } catch {
          // ignore invalid JSON
        }
      }
    };
    fetchRecent();
  }, [expertId]);

  // Auto-advance when connected
  useEffect(() => {
    if (phase === "connecting" && verifyStatus === "connected" && keyId) {
      const timer = setTimeout(() => {
        onComplete({
          keyId,
          apiKey,
          channel: channel!,
          subChannel,
          clientName: name,
        });
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [phase, verifyStatus, keyId, apiKey, channel, subChannel, name, onComplete]);

  const handleCreate = async () => {
    if (!channel) return;
    setPhase("creating");
    setError(null);

    try {
      const keyRes = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          expertId,
          scope: "full",
          rateLimitPerMinute: 150,
          clientChannel: channel,
          clientSubChannel: subChannel ?? undefined,
        }),
      });

      if (!keyRes.ok) {
        const errData = await keyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create client");
      }

      const keyData = await keyRes.json();
      const createdKeyId: string = keyData.key?.id ?? keyData.id;
      const createdApiKey: string = keyData.key?.key ?? keyData.key;

      setKeyId(createdKeyId);
      setApiKey(createdApiKey);

      // Generate setup link (summonContext is passed directly in the body)
      const linkRes = await fetch("/api/v1/setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId: createdKeyId,
          channel,
          subChannel,
          ...(summonContext.trim() && { summonContext: summonContext.trim() }),
          ...(timeout !== DEFAULT_TIMEOUT && { timeout }),
          ...(pollInterval !== DEFAULT_POLL_INTERVAL && { pollInterval }),
        }),
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        setSetupUrl(linkData.setupUrl);
      }

      setPhase("connecting");
      // Start polling — use setTimeout so the keyId state is flushed
      setTimeout(() => start(), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("details");
    }
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const skillDir = meta?.skillDir ?? "";
  const installCmd =
    isSkillBased && apiKey
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
HEYSUMMON_POLL_INTERVAL=${pollInterval}${summonContext.trim() ? `\nHEYSUMMON_SUMMON_CONTEXT=${summonContext.trim()}` : ""}
EOF
echo "Verifying connection..." && \\
curl -sf "${baseUrl}/api/v1/whoami" \\
  -H "x-api-key: ${apiKey}" > /dev/null && \\
echo "Connected and device bound successfully."`
      : "";

  // Recently used contexts (truncated, max 5 shown) excluding presets
  const presetTexts = SUMMON_CONTEXT_PRESETS.map((p) => p.text);
  const recentNonPreset = recentContexts
    .filter((c) => !presetTexts.includes(c))
    .slice(0, MAX_RECENT_SHOWN);

  return (
    <div>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Connect a Client
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Choose an AI assistant platform and connect it to your expert.
      </p>

      {/* Phase: Channel selection */}
      {phase === "channel" && (
        <div className="animate-in fade-in duration-200">
          <ClientChannelSelector
            selected={channel}
            subChannel={subChannel}
            onSelect={(ch) => {
              setChannel(ch);
              setSubChannel(null);
            }}
            onSubChannelSelect={setSubChannel}
          />
          <div className="flex justify-end">
            <button
              onClick={() => setPhase("details")}
              disabled={!channel || (channel === "openclaw" && !subChannel)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Phase: Details */}
      {phase === "details" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Client name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Claude Code Assistant"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Expert
            </label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-sm text-foreground">{expertName}</span>
              <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                Connected
              </span>
            </div>
          </div>

          {/* Response time -- preset selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              How fast will you typically respond?
            </label>
            <div className="grid grid-cols-2 gap-2">
              {TIMEOUT_PRESETS.map((preset) => {
                const isSelected =
                  preset.value === -1
                    ? customTimeout !== null
                    : customTimeout === null && timeout === preset.value;
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => {
                      if (preset.value === -1) {
                        setCustomTimeout(timeout);
                      } else {
                        setCustomTimeout(null);
                        setTimeout_(preset.value);
                      }
                    }}
                    className={`rounded-md border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}
                    >
                      {preset.label}
                    </span>
                    {preset.desc && (
                      <span className="block text-[11px] text-muted-foreground">
                        {preset.desc}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {customTimeout !== null && (
              <div className="mt-2 animate-in fade-in duration-200">
                <input
                  type="number"
                  min={10}
                  max={3600}
                  value={timeout}
                  onChange={(e) =>
                    setTimeout_(Number(e.target.value) || DEFAULT_TIMEOUT)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Timeout in seconds"
                />
              </div>
            )}
          </div>

          {/* Good vs Bad example -- educational */}
          <div>
            <button
              type="button"
              onClick={() => setShowExamples((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showExamples ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              What makes a good help request?
            </button>

            {showExamples && (
              <div className="mt-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="rounded-md border border-green-200 dark:border-green-900/40 bg-green-50/50 dark:bg-green-950/10 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-green-600 dark:text-green-400 mb-1">
                    Good request
                  </p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{`I'm implementing the checkout flow.
The design shows a discount code field
but the API spec has no discount endpoint.

Should I:
A) Skip the discount field for now
B) Create a /discounts endpoint myself`}</pre>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Specific context, clear options -- answerable in seconds.
                  </p>
                </div>
                <div className="rounded-md border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 mb-1">
                    Bad request
                  </p>
                  <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{`What should I do next?`}</pre>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    No context, no options -- takes minutes to understand.
                  </p>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tip: configure your agent&apos;s system prompt to include project
                  context and suggest options when asking for help.
                </p>
              </div>
            )}
          </div>

          {/* Summoning context */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Summoning guidelines for this client (optional)
            </label>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Tell the AI when it should and shouldn&apos;t summon you. This context
              is included in the consumer&apos;s environment.
            </p>

            {/* Recently used contexts */}
            {recentNonPreset.length > 0 && (
              <div className="mb-2">
                <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                  Recently used
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recentNonPreset.map((ctx, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSummonContext(ctx)}
                      className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors max-w-[200px] truncate ${
                        summonContext === ctx
                          ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      }`}
                      title={ctx}
                    >
                      {ctx.length > 40 ? ctx.slice(0, 40) + "..." : ctx}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2 flex flex-wrap gap-1.5">
              {SUMMON_CONTEXT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setSummonContext(preset.text)}
                  className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    summonContext === preset.text
                      ? "border-primary bg-primary/5 text-primary dark:bg-primary/10"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <textarea
              value={summonContext}
              onChange={(e) => setSummonContext(e.target.value.slice(0, 500))}
              placeholder="e.g. Only summon me when you need architecture decisions or production access..."
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring resize-none"
            />
            <p className="mt-1 text-right text-[11px] text-muted-foreground">
              {summonContext.length}/500
            </p>
          </div>

          {/* Advanced settings -- poll interval */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/20 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Poll interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={pollInterval}
                    onChange={(e) =>
                      setPollInterval(
                        Number(e.target.value) || DEFAULT_POLL_INTERVAL
                      )
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    How often the client checks for a response. Lower = faster
                    delivery, more API calls.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between">
            <button
              onClick={() => setPhase("channel")}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Back
            </button>
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              Create & Connect
            </button>
          </div>
        </div>
      )}

      {/* Phase: Creating */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-3 py-8 animate-in fade-in duration-200">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Creating client...</p>
        </div>
      )}

      {/* Phase: Connecting */}
      {phase === "connecting" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {summonContext.trim() && (
            <div className="rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/10 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-1">
                Summoning guidelines
              </p>
              <p className="text-xs text-foreground whitespace-pre-wrap">
                {summonContext.trim()}
              </p>
            </div>
          )}
          {isSkillBased ? (
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
                  className="absolute right-2 top-1 text-xs text-primary hover:text-primary/80"
                >
                  {copied === installCmd ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-black p-4">
              <p className="mb-2 text-xs text-muted-foreground font-medium">
                Setup link:
              </p>
              <div className="flex items-start gap-2">
                <code className="text-xs text-green-400 break-all flex-1">
                  {setupUrl}
                </code>
                <button
                  onClick={() => handleCopy(setupUrl)}
                  className="shrink-0 text-xs text-primary hover:text-primary/80"
                >
                  {copied === setupUrl ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-3 rounded-lg border border-border p-4">
            {verifyStatus === "checking" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
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
            {verifyStatus === "connected" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0 animate-in zoom-in duration-300">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Client connected!
                </p>
              </>
            )}
            {verifyStatus === "timeout" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
                  <span className="text-white text-sm">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Connection timed out
                  </p>
                </div>
              </>
            )}
          </div>

          {verifyStatus === "timeout" && (
            <div className="flex gap-2">
              <button
                onClick={retry}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Retry
              </button>
              <button
                onClick={() =>
                  onComplete({
                    keyId,
                    apiKey,
                    channel: channel!,
                    subChannel,
                    clientName: name,
                  })
                }
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip verification
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
