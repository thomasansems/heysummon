"use client";

import { useState, useEffect } from "react";
import {
  Loader2,
  Check,
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
  Lightbulb,
  Settings,
  ScrollText,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { copyToClipboard } from "@/lib/clipboard";
import { useConnectionVerify } from "@/hooks/use-connection-verify";
import {
  ClientChannelSelector,
  type ClientChannelType,
  type ClientSubChannelType,
} from "@/components/shared/client-channel-selector";
import { SUMMON_CONTEXT_PRESETS } from "@/lib/summon-context-presets";
import { buildSetupCopyText } from "@/lib/setup-copy-text";
import { SuccessCelebration } from "@/components/onboarding/success-celebration";

const DEFAULT_TIMEOUT = 900;
const DEFAULT_POLL_INTERVAL = 3;
const MAX_RECENT_SHOWN = 5;

const TIMEOUT_PRESETS = [
  { value: 300, label: "5 min", desc: "You're actively available" },
  { value: 900, label: "15 min", desc: "Checking your phone regularly" },
  { value: 1800, label: "30 min", desc: "In meetings, checking between" },
  { value: -1, label: "Custom", desc: "" },
];

type Phase = "channel" | "details" | "creating" | "connecting";

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
  const [showExamples, setShowExamples] = useState(false);
  const [summonContext, setSummonContext] = useState("");
  const [recentContexts, setRecentContexts] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Created client data
  const [keyId, setKeyId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [setupUrl, setSetupUrl] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

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

  // Start verification when connecting phase begins and keyId is ready
  useEffect(() => {
    if (phase === "connecting" && keyId) {
      start();
    }
  }, [phase, keyId, start]);


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

  const copyText = buildSetupCopyText(setupUrl, summonContext);

  // Recently used contexts (truncated, max 5 shown) excluding presets
  const presetTexts = SUMMON_CONTEXT_PRESETS.map((p) => p.text);
  const recentNonPreset = recentContexts
    .filter((c) => !presetTexts.includes(c))
    .slice(0, MAX_RECENT_SHOWN);

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Building2 className="h-5 w-5 text-primary shrink-0" />
        Connect a Client
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Choose your AI platform and link it to your expert.
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
              <Lightbulb className="h-3.5 w-3.5" />
              What makes a good help request?
            </button>

            {showExamples && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 animate-in fade-in slide-in-from-top-2 duration-200">
                <Card size="sm" className="border-green-200 dark:border-green-900/40 bg-green-50/30 dark:bg-green-950/10">
                  <CardHeader className="pb-0">
                    <CardTitle className="flex items-center gap-1.5 text-xs font-semibold text-green-600 dark:text-green-400">
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Good request
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{`I'm implementing the checkout flow.
The design shows a discount code field
but the API spec has no discount endpoint.

Should I:
A) Skip the discount field for now
B) Create a /discounts endpoint myself`}</pre>
                    <p className="text-[11px] text-muted-foreground">
                      Context + options = answerable in seconds.
                    </p>
                  </CardContent>
                </Card>
                <Card size="sm" className="border-red-200 dark:border-red-900/40 bg-red-50/30 dark:bg-red-950/10">
                  <CardHeader className="pb-0">
                    <CardTitle className="flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                      <XCircle className="h-4 w-4 shrink-0" />
                      Bad request
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <pre className="text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">{`What should I do next?`}</pre>
                    <p className="text-[11px] text-muted-foreground">
                      No context = slow to answer.
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Summoning context */}
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ScrollText className="h-3.5 w-3.5" />
              Summoning guidelines (optional)
            </label>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Tell the AI when to summon you.
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
              <Settings className="h-3.5 w-3.5" />
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
                    Lower = faster delivery, more API calls.
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
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </span>
            </button>
            <button
              onClick={handleCreate}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create & Connect
              </span>
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
          <p className="text-sm text-muted-foreground">
            Paste these instructions into your AI client.
          </p>

          {/* Setup instructions as copyable text */}
          <div className="rounded-md border border-border bg-black p-4">
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
