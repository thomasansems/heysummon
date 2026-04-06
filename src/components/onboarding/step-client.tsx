"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  ChevronDown,
  ChevronRight,
  Building2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Copy,
  ExternalLink,
  RefreshCw,
  SkipForward,
  RotateCcw,
  Clock,
  Settings,
  ScrollText,
} from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { useConnectionVerify } from "@/hooks/use-connection-verify";
import {
  ClientChannelSelector,
  type ClientChannelType,
  type ClientSubChannelType,
} from "@/components/shared/client-channel-selector";
import { buildSetupCopyText } from "@/lib/setup-copy-text";
import { SuccessCelebration } from "@/components/onboarding/success-celebration";
import {
  SummoningWizard,
  type WizardState,
  DEFAULT_WIZARD_STATE,
  generateGuidelines,
} from "@/components/shared/summoning-wizard";

const DEFAULT_TIMEOUT = 900; // 15 min
const DEFAULT_POLL_INTERVAL = 3;

const TIMEOUT_PRESETS = [
  { value: 300, label: "5 min", desc: "You're actively available" },
  { value: 900, label: "15 min", desc: "Checking your phone regularly" },
  { value: 1800, label: "30 min", desc: "In meetings, checking between" },
  { value: -1, label: "Custom", desc: "" },
];

type Phase = "channel" | "details" | "guidelines" | "creating" | "connecting";

interface StepClientProps {
  expertId: string;
  expertName: string;
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
  const [summonContext, setSummonContext] = useState("");
  const [wizardMeta, setWizardMeta] = useState<WizardState | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Created client data
  const [keyId, setKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const { status: verifyStatus, elapsed, start, retry } = useConnectionVerify({
    keyId: keyId || "noop",
    timeoutMs: 600_000,
  });

  // Fetch recently used wizard state from expert
  useEffect(() => {
    const fetchRecent = async () => {
      const res = await fetch(`/api/experts/${expertId}`);
      if (!res.ok) return;
      const data = await res.json();
      const raw = data.expert?.recentSummonContexts;
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Find the most recent wizard entry with meta for pre-populating
            const latest = parsed.find(
              (c: unknown): c is { text: string; meta: WizardState } =>
                typeof c === "object" && c !== null && "meta" in c,
            );
            if (latest) {
              setWizardMeta(latest.meta);
            }
          }
        } catch {
          // ignore invalid JSON
        }
      }
    };
    fetchRecent();
  }, [expertId]);

  // Start verification when connecting phase begins and keyId is ready
  useEffect(() => {
    if (phase === "connecting" && keyId) {
      start();
    }
  }, [phase, keyId, start]);


  const handleCreate = async (
    summonContextOverride?: string,
    wizardMetaOverride?: WizardState,
  ) => {
    if (!channel) return;
    setPhase("creating");
    setError(null);

    const ctxToUse = summonContextOverride ?? summonContext;
    const metaToUse = wizardMetaOverride ?? wizardMeta;

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
          ...(ctxToUse.trim() && { summonContext: ctxToUse.trim() }),
          ...(metaToUse && { summonContextMeta: metaToUse }),
          ...(timeout !== DEFAULT_TIMEOUT && { timeout }),
          ...(pollInterval !== DEFAULT_POLL_INTERVAL && { pollInterval }),
        }),
      });
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        setSetupUrl(linkData.setupUrl);
      }

      setPhase("connecting");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("guidelines");
    }
  };

  const handleCopy = (text: string) => {
    copyToClipboard(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  const copyText = buildSetupCopyText(setupUrl, summonContext, channel ?? "claudecode");

  const PHASE_TITLES: Record<string, { icon: React.ReactNode; title: string; subtitle: string }> = {
    channel: { icon: <Building2 className="h-5 w-5 shrink-0" />, title: "Connect a Client", subtitle: "Choose your AI platform and link it to your expert." },
    details:  { icon: <Settings className="h-5 w-5 shrink-0" />, title: "Client settings", subtitle: "Optional name and response preferences." },
    guidelines: { icon: <ScrollText className="h-5 w-5 shrink-0" />, title: "Summoning guidelines", subtitle: "Tell the AI when and how to summon you." },
    creating: { icon: <Building2 className="h-5 w-5 shrink-0" />, title: "Connect a Client", subtitle: "" },
    connecting: { icon: <Building2 className="h-5 w-5 shrink-0" />, title: "Connect a Client", subtitle: "" },
  };
  const phaseInfo = PHASE_TITLES[phase] ?? PHASE_TITLES.channel;

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        {phaseInfo.icon}
        {phaseInfo.title}
      </h2>
      {phaseInfo.subtitle && (
        <p className="mb-5 text-sm text-muted-foreground">{phaseInfo.subtitle}</p>
      )}

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
              <span className="flex items-center gap-1.5">
                Next
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Phase: Details */}
      {phase === "details" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Client name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Claude Code Assistant"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          {/* Advanced settings */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              <Settings className="h-3.5 w-3.5 ml-0.5" />
              Advanced settings
            </button>
            {showAdvanced && (
              <div className="mt-3 rounded-md bg-muted/20 p-3 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Response timeout */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    Response timeout
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
                          <span className={`text-sm font-medium ${isSelected ? "text-primary" : "text-foreground"}`}>
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
                        onChange={(e) => setTimeout_(Number(e.target.value) || DEFAULT_TIMEOUT)}
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        placeholder="Timeout in seconds"
                      />
                    </div>
                  )}
                </div>
                {/* Poll interval */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Poll interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Number(e.target.value) || DEFAULT_POLL_INTERVAL)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">Lower = faster delivery, more API calls.</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setPhase("channel")}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </span>
            </button>
            <button
              onClick={() => setPhase("guidelines")}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                Next
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Phase: Guidelines */}
      {phase === "guidelines" && (
        <div className="animate-in fade-in duration-200 pt-4">
          <SummoningWizard
            initialState={wizardMeta ?? DEFAULT_WIZARD_STATE}
            completeLabel="Create & Connect"
            completeIcon={<Plus className="h-4 w-4" />}
            onComplete={(text, state) => {
              setSummonContext(text);
              setWizardMeta(state);
              handleCreate(text, state);
            }}
            onSkip={() => {
              const defaultText = generateGuidelines(DEFAULT_WIZARD_STATE);
              setSummonContext(defaultText);
              setWizardMeta(DEFAULT_WIZARD_STATE);
              handleCreate(defaultText, DEFAULT_WIZARD_STATE);
            }}
          />
          {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
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
          <p className="text-sm text-muted-foreground">
            Copy and paste these instructions into your AI client, or follow the steps manually.
            Feel free to edit the text to your liking before pasting.
          </p>

          {/* Setup instructions as copyable text */}
          <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-black p-4">
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
              {copyText}
            </pre>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleCopy(copyText)}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Copy className="h-4 w-4" />
                {copied === copyText ? "Copied!" : "Copy instructions"}
              </span>
            </button>
            <a
              href={setupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Preview setup page
            </a>
          </div>

          {/* Connection status */}
          {verifyStatus === "checking" && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
              <div>
                <p className="text-sm text-foreground">
                  Waiting for connection... ({elapsed}s)
                </p>
                <p className="text-xs text-muted-foreground">
                  Connects automatically when setup is complete
                </p>
              </div>
            </div>
          )}

          {verifyStatus === "connected" && (
            <SuccessCelebration
              label="Client connected!"
              sublabel="Your AI client is linked and ready to send help requests."
              onContinue={() =>
                onComplete({
                  keyId,
                  apiKey,
                  channel: channel!,
                  subChannel,
                  clientName: name,
                })
              }
            />
          )}

          {verifyStatus === "timeout" && (
            <div className="flex items-center gap-3 rounded-lg border border-border p-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
                <span className="text-white text-sm">!</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                  Connection timed out
                </p>
              </div>
            </div>
          )}

          {verifyStatus === "timeout" && (
            <div className="flex gap-2">
              <button
                onClick={retry}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry connection
                </span>
              </button>
              <button
                onClick={() => {
                  setPhase("channel");
                  setKeyId("");
                  setApiKey("");
                  setSetupUrl("");
                }}
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Start over
                </span>
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
                <span className="flex items-center gap-1.5">
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
