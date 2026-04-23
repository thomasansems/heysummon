"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { buildSetupCopyText } from "@/lib/setup-copy-text";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check, ChevronDown, ChevronRight, Plus, Terminal } from "lucide-react";
import type { ComponentType } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ClientDetailPanel } from "@/components/dashboard/client-detail-panel";
import {
  SummoningWizard,
  type WizardState,
  DEFAULT_WIZARD_STATE,
  generateGuidelines,
} from "@/components/shared/summoning-wizard";

interface ExpertChannel {
  id: string;
  type: string;
  status: string;
}

interface ExpertProfile {
  id: string;
  name: string;
  isActive: boolean;
  expertChannels: ExpertChannel[];
}

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface ApiKey {
  id: string;
  key: string;
  name: string | null;
  isActive: boolean;
  scope: string;
  rateLimitPerMinute: number;
  clientChannel: string | null;
  clientSubChannel: string | null;
  previousKeyExpiresAt: string | null;
  createdAt: string;
  machineId: string | null;
  expert: ExpertProfile | null;
  ipEvents: IpEvent[];
  _count: { requests: number };
}

const channelLabel = (channel: string | null, sub: string | null) => {
  if (!channel) return null;
  if (channel === "claudecode") return { label: "Claude Code", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300" };
  if (channel === "openclaw" && sub === "whatsapp") return { label: "OpenClaw · WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" };
  if (channel === "openclaw") return { label: "OpenClaw · Telegram", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" };
  if (channel === "codex") return { label: "Codex CLI", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" };
  if (channel === "gemini") return { label: "Gemini CLI", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" };
  if (channel === "custom") {
    const label = sub && sub.trim().length > 0 ? `Custom · ${sub}` : "Custom";
    return { label, color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" };
  }
  return null;
};

function expertStatus(expert: ExpertProfile | null): { label: string; warning: string | null } {
  if (!expert) return { label: "—", warning: "No expert linked — requests cannot be delivered." };
  if (!expert.isActive) return { label: expert.name, warning: "Expert is inactive." };
  if (expert.expertChannels.length === 0) return { label: expert.name, warning: "Expert has no channel configured — requests will be blocked." };
  return { label: expert.name, warning: null };
}

type WizardChannel = "openclaw" | "claudecode" | "codex" | "gemini" | "custom" | null;
type WizardSubChannel = "telegram" | "whatsapp" | null;

const CUSTOM_LABEL_MAX = 64;
// eslint-disable-next-line no-control-regex -- intentionally rejecting control chars in the label
const CUSTOM_LABEL_DISALLOWED = /[\x00-\x1f\x7f<>]/;

function validateCustomLabel(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return "Client label is required.";
  if (trimmed.length > CUSTOM_LABEL_MAX) return `Keep it under ${CUSTOM_LABEL_MAX} characters.`;
  if (CUSTOM_LABEL_DISALLOWED.test(trimmed)) return "No control characters or angle brackets.";
  return null;
}

type ClientChannelTile = {
  id: WizardChannel;
  label: string;
  icon: string | null;
  Icon?: ComponentType<{ className?: string }>;
  description: string;
  disabled: boolean;
};

const CLIENT_CHANNELS: ClientChannelTile[] = [
  {
    id: "openclaw",
    label: "OpenClaw",
    icon: "/icons/openclaw.svg",
    description: "AI agent via Telegram or WhatsApp",
    disabled: false,
  },
  {
    id: "claudecode",
    label: "Claude Code",
    icon: "/icons/claudecode.svg",
    description: "Anthropic — skill in editor",
    disabled: false,
  },
  {
    id: "codex",
    label: "Codex CLI",
    icon: "/icons/codex.svg",
    description: "OpenAI — terminal agent",
    disabled: false,
  },
  {
    id: "custom",
    label: "Custom",
    icon: null,
    Icon: Terminal,
    description: "API-only — any runtime",
    disabled: false,
  },
  {
    id: null,
    label: "Gemini CLI",
    icon: "/icons/gemini.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "OpenAI",
    icon: "/icons/openai.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "NanoClaw",
    icon: "/icons/docker.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "NemoClaw",
    icon: "/icons/nvidia.svg",
    description: "Coming soon",
    disabled: true,
  },
];

const OPENCLAW_PLATFORMS = [
  { id: "telegram" as const, label: "Telegram", icon: "/icons/telegram.svg" },
  { id: "whatsapp" as const, label: "WhatsApp", icon: "/icons/whatsapp.svg" },
];

type WizardStep = 0 | 1 | 2 | 3 | 4; // 0=closed, 1=channel, 2=details, 3=guidelines, 4=done

const SCOPE_OPTIONS = ["full", "read", "write", "admin"] as const;

const scopeBadgeColors: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  read: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  write: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  admin: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

export default function ClientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  const selectedClientId = searchParams.get("id");
  const setSelectedClientId = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("id", id);
    } else {
      params.delete("id");
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [searchParams, router]);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [wizardChannel, setWizardChannel] = useState<WizardChannel>(null);
  const [wizardSubChannel, setWizardSubChannel] = useState<WizardSubChannel>(null);
  const [wizardCustomLabel, setWizardCustomLabel] = useState("");
  const [wizardName, setWizardName] = useState("");
  const [wizardExpertId, setWizardExpertId] = useState("");
  const [wizardCreating, setWizardCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardResult, setWizardResult] = useState<{ keyId: string; key: string; setupUrl: string; expiresAt: string } | null>(null);

  // Advanced settings
  const [wizardShowAdvanced, setWizardShowAdvanced] = useState(false);
  const [wizardTimeout, setWizardTimeout] = useState(900);
  const [wizardPollInterval, setWizardPollInterval] = useState(3);
  const [wizardGlobalInstall, setWizardGlobalInstall] = useState(true);

  // Summoning context
  const [wizardSummonContext, setWizardSummonContext] = useState("");
  const [wizardRecentContexts, setWizardRecentContexts] = useState<string[]>([]);
  const [wizardMeta, setWizardMeta] = useState<WizardState | null>(null);

  const loadKeys = () =>
    fetch("/api/v1/keys")
      .then((r) => {
        if (!r.ok) return { keys: [] };
        return r.json();
      })
      .then((data) => {
        setKeys(data.keys || []);
        setLoading(false);
      })
      .catch(() => {
        setKeys([]);
        setLoading(false);
      });

  const loadExperts = () =>
    fetch("/api/experts")
      .then((r) => {
        if (!r.ok) return { experts: [] };
        return r.json();
      })
      .then((data) => {
        setExperts(data.experts || []);
      })
      .catch(() => setExperts([]));

  useEffect(() => {
    loadKeys();
    loadExperts();
  }, []);

  // Fetch recently used summoning contexts when expert changes
  useEffect(() => {
    if (!wizardExpertId) {
      setWizardRecentContexts([]);
      return;
    }
    fetch(`/api/experts/${wizardExpertId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const raw = data?.expert?.recentSummonContexts;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              // Items can be plain strings or {text, meta} objects
              const texts = parsed
                .map((item: unknown) => {
                  if (typeof item === "string") return item;
                  if (typeof item === "object" && item !== null && "text" in item) {
                    return (item as { text: string }).text;
                  }
                  return null;
                })
                .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
              setWizardRecentContexts(texts);
            }
          } catch {
            // ignore invalid JSON
          }
        }
      })
      .catch(() => {});
  }, [wizardExpertId]);

  const openWizard = () => {
    setWizardStep(1);
    setWizardChannel(null);
    setWizardSubChannel(null);
    setWizardCustomLabel("");
    setWizardName("");
    setWizardExpertId("");
    setWizardError(null);
    setWizardResult(null);
    setWizardShowAdvanced(false);
    setWizardTimeout(900);
    setWizardPollInterval(3);
    setWizardGlobalInstall(true);
    setWizardSummonContext("");
    setWizardRecentContexts([]);
    setWizardMeta(null);
  };

  const closeWizard = () => {
    setWizardStep(0);
    setWizardResult(null);
    setWizardSummonContext("");
    setWizardMeta(null);
  };

  const customLabelError = wizardChannel === "custom" ? validateCustomLabel(wizardCustomLabel) : null;

  const wizardNext = () => {
    if (wizardStep === 1) {
      // Validate channel selected
      if (!wizardChannel) return;
      if (wizardChannel === "openclaw" && !wizardSubChannel) return;
      setWizardStep(2);
    } else if (wizardStep === 2) {
      // Go to guidelines step
      if (!wizardExpertId) return;
      if (wizardChannel === "custom" && customLabelError) return;
      setWizardStep(3);
    }
  };

  const DEFAULT_RATE_LIMIT = parseInt(process.env.NEXT_PUBLIC_DEFAULT_RATE_LIMIT ?? "150");

  const createWizardKey = async (
    summonContextOverride?: string,
    metaOverride?: WizardState,
  ) => {
    if (!wizardExpertId) return;
    setWizardCreating(true);

    const ctxToUse = summonContextOverride ?? wizardSummonContext;
    const metaToUse = metaOverride ?? wizardMeta;

    const subChannelPayload =
      wizardChannel === "custom"
        ? wizardCustomLabel.trim()
        : wizardSubChannel ?? undefined;

    // Create the key (rate limit defaults to env var or 150)
    const keyRes = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: wizardName || undefined,
        expertId: wizardExpertId,
        scope: "full",
        rateLimitPerMinute: DEFAULT_RATE_LIMIT,
        clientChannel: wizardChannel,
        clientSubChannel: subChannelPayload,
      }),
    });

    if (!keyRes.ok) {
      const errText = await keyRes.text().catch(() => "");
      const errData = errText ? JSON.parse(errText) : {};
      setWizardError(errData.error || `Failed to create key (${keyRes.status})`);
      setWizardCreating(false);
      return;
    }

    const keyData = await keyRes.json();
    const keyId: string = keyData.key?.id ?? keyData.id;

    if (!keyId) {
      setWizardError("Unexpected response from server — no key ID returned");
      setWizardCreating(false);
      return;
    }

    // Generate temporary setup link (10 min expiry)
    const linkRes = await fetch("/api/v1/setup-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyId,
        channel: wizardChannel,
        subChannel: wizardSubChannel,
        ...(ctxToUse.trim() && { summonContext: ctxToUse.trim() }),
        ...(metaToUse && { summonContextMeta: metaToUse }),
        ...(metaToUse?.timeoutFallback && metaToUse.timeoutFallback !== "proceed_cautiously" && { timeoutFallback: metaToUse.timeoutFallback }),
        ...(wizardTimeout !== 900 && { timeout: wizardTimeout }),
        ...(wizardPollInterval !== 3 && { pollInterval: wizardPollInterval }),
        ...(wizardGlobalInstall === false && { globalInstall: false }),
      }),
    });

    if (!linkRes.ok) {
      setWizardError("Key created, but failed to generate setup link. Use 'Share' from the client menu.");
      setWizardCreating(false);
      setWizardStep(4);
      loadKeys();
      return;
    }

    const linkData = await linkRes.json();

    setWizardResult({
      keyId,
      key: keyData.key?.key || keyData.key,
      setupUrl: linkData.setupUrl,
      expiresAt: linkData.expiresAt,
    });
    setWizardCreating(false);
    setWizardStep(4);
    loadKeys();
  };



  const wizardCopyText = buildSetupCopyText(wizardResult?.setupUrl ?? "", wizardSummonContext, wizardChannel ?? "claudecode");

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 8) + "\u2022".repeat(16) + key.slice(-4);

  const isInGracePeriod = (k: ApiKey) =>
    k.previousKeyExpiresAt && new Date(k.previousKeyExpiresAt) > new Date();

  // ─── Wizard Modal ────────────────────────────────────────────────────────────
  const renderWizard = () => {
    if (wizardStep === 0) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
          {/* Close */}
          <button
            onClick={closeWizard}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>

          {/* Step 1 — Channel */}
          {wizardStep === 1 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-foreground">Create New Client</h2>
              <p className="mb-6 text-sm text-muted-foreground">
                Which channel does this client use?
              </p>

              {/* Channel grid */}
              <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {CLIENT_CHANNELS.map((ch) => (
                  <button
                    key={ch.label}
                    disabled={ch.disabled}
                    onClick={() => { if (!ch.disabled && ch.id) { setWizardChannel(ch.id); setWizardSubChannel(null); } }}
                    className={`relative rounded-lg border p-4 text-left transition-colors ${
                      ch.disabled
                        ? "cursor-not-allowed opacity-50 border-border"
                        : wizardChannel === ch.id
                          ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30"
                          : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    {ch.disabled && (
                      <span className="absolute right-2 top-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Soon</span>
                    )}
                    <div className="mb-2 flex items-center gap-2">
                      {ch.Icon ? (
                        <ch.Icon className="h-7 w-7 rounded p-1 text-foreground" />
                      ) : (
                        <img src={ch.icon ?? ""} alt={ch.label} className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      )}
                      <span className="text-sm font-medium text-foreground">{ch.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{ch.description}</p>
                  </button>
                ))}
              </div>

              {/* Sub-channel for OpenClaw */}
              {wizardChannel === "openclaw" && (
                <div className="mb-5">
                  <p className="mb-3 text-sm text-muted-foreground">Where does the client use OpenClaw?</p>
                  <div className="grid grid-cols-2 gap-3">
                    {OPENCLAW_PLATFORMS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setWizardSubChannel(p.id)}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                          wizardSubChannel === p.id
                            ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <img src={p.icon} alt={p.label} className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <span className="text-sm font-medium text-foreground">{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button onClick={closeWizard} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                  Cancel
                </button>
                <button
                  onClick={wizardNext}
                  disabled={!wizardChannel || (wizardChannel === "openclaw" && !wizardSubChannel)}
                  className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Details */}
          {wizardStep === 2 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-foreground">Client Details</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                {wizardChannel === "openclaw"
                  ? `Configure your OpenClaw ${wizardSubChannel} client`
                  : `Configure your ${CLIENT_CHANNELS.find((c) => c.id === wizardChannel)?.label ?? wizardChannel} client`}
              </p>

              <div className="mb-4 space-y-3">
                {/* Custom client label */}
                {wizardChannel === "custom" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Client label <span className="text-red-400">*</span>
                    </label>
                    <input
                      value={wizardCustomLabel}
                      onChange={(e) => setWizardCustomLabel(e.target.value)}
                      placeholder="e.g. n8n, MyPaperclipAgent, homegrown-cli"
                      maxLength={CUSTOM_LABEL_MAX}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    />
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Shown in the clients table so you can tell custom integrations apart. Max {CUSTOM_LABEL_MAX} characters.
                    </p>
                    {customLabelError && wizardCustomLabel.length > 0 && (
                      <p className="mt-1 text-[11px] text-red-500">{customLabelError}</p>
                    )}
                  </div>
                )}

                {/* Name */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Client name</label>
                  <input
                    value={wizardName}
                    onChange={(e) => setWizardName(e.target.value)}
                    placeholder="e.g. John's Assistant"
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>

                {/* Expert */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Expert <span className="text-red-400">*</span></label>
                  {experts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No experts yet.{" "}
                      <a href="/dashboard/experts" className="text-orange-600 hover:text-orange-800">Create one first</a>.
                    </p>
                  ) : (
                    <select
                      value={wizardExpertId}
                      onChange={(e) => setWizardExpertId(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    >
                      <option value="">Select expert...</option>
                      {experts.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Advanced settings */}
                <div>
                  <button
                    type="button"
                    onClick={() => setWizardShowAdvanced((v) => !v)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {wizardShowAdvanced ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                    Advanced settings
                  </button>

                  {wizardShowAdvanced && (
                    <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/20 p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Request timeout (seconds)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={3600}
                          value={wizardTimeout}
                          onChange={(e) => setWizardTimeout(Number(e.target.value) || 900)}
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        />
                        <p className="mt-0.5 text-[11px] text-muted-foreground">How long the client waits for a response before timing out (default: 900)</p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Poll interval (seconds)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={wizardPollInterval}
                          onChange={(e) => setWizardPollInterval(Number(e.target.value) || 3)}
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        />
                        <p className="mt-0.5 text-[11px] text-muted-foreground">How often the client checks for new messages (default: 3)</p>
                      </div>
                      {wizardChannel !== "openclaw" && wizardChannel !== "custom" && (
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="wizard-global-install"
                            checked={wizardGlobalInstall}
                            onChange={(e) => setWizardGlobalInstall(e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-border accent-foreground"
                          />
                          <label htmlFor="wizard-global-install" className="text-xs text-muted-foreground">
                            Install SDK globally (<code className="text-[11px]">npm install -g</code>)
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between gap-2">
                <button onClick={() => setWizardStep(1)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                  ← Back
                </button>
                <div className="flex gap-2">
                  <button onClick={closeWizard} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">
                    Cancel
                  </button>
                  <button
                    onClick={wizardNext}
                    disabled={!wizardExpertId || (wizardChannel === "custom" && !!customLabelError)}
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    Next →
                  </button>
                </div>
              </div>
              {wizardError && (
                <p className="mt-2 text-xs text-red-500">{wizardError}</p>
              )}
            </div>
          )}

          {/* Step 3 — Summoning Guidelines */}
          {wizardStep === 3 && (
            <div>
              <h2 className="mb-1 text-lg font-semibold text-foreground">Summoning Guidelines</h2>
              <p className="mb-5 text-sm text-muted-foreground">
                Tell the AI when and how to summon your expert.
              </p>

              <SummoningWizard
                initialState={wizardMeta ?? DEFAULT_WIZARD_STATE}
                completeLabel="Create & Connect"
                completeIcon={<Plus className="h-4 w-4" />}
                onComplete={(text, state) => {
                  setWizardSummonContext(text);
                  setWizardMeta(state);
                  createWizardKey(text, state);
                }}
                onSkip={() => {
                  const defaultText = generateGuidelines(DEFAULT_WIZARD_STATE);
                  setWizardSummonContext(defaultText);
                  setWizardMeta(DEFAULT_WIZARD_STATE);
                  createWizardKey(defaultText, DEFAULT_WIZARD_STATE);
                }}
              />
              {wizardCreating && (
                <p className="mt-3 text-sm text-muted-foreground animate-pulse">Creating client...</p>
              )}
              {wizardError && (
                <p className="mt-2 text-xs text-red-500">{wizardError}</p>
              )}
            </div>
          )}

          {/* Step 4 — Done / Setup URL */}
          {wizardStep === 4 && wizardResult && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Check className="h-6 w-6 text-green-600" />
                <h2 className="text-lg font-semibold text-foreground">Client created!</h2>
              </div>

              <p className="mb-3 text-sm text-muted-foreground">
                Copy and paste these instructions into your AI client, or follow the steps manually.
                Feel free to edit the text to your liking before pasting.
              </p>

              <div className="mb-3 max-h-64 overflow-y-auto rounded-md border border-border bg-black p-4">
                <pre className="text-xs text-zinc-300 whitespace-pre-wrap break-words font-mono leading-relaxed">
                  {wizardCopyText}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyKey(wizardCopyText)}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                >
                  {copied === wizardCopyText ? "Copied!" : "Copy instructions"}
                </button>
                <a
                  href={wizardResult.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Preview setup page
                </a>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                After the link expires, generate a new one via the{" "}
                <strong>Setup</strong> option in the client&apos;s action menu.
              </p>

              <div className="mt-5 flex justify-end">
                <button
                  onClick={closeWizard}
                  className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Step indicator */}
          {wizardStep < 4 && (
            <div className="mt-6 flex justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    s <= wizardStep ? "bg-orange-600" : "bg-muted"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderWizard()}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Clients</h1>
        <button
          onClick={openWizard}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Create New Client
        </button>
      </div>

      <div className="overflow-visible overflow-x-auto rounded-lg border border-border bg-card">
        {loading ? (
          <>
            <div className="md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-border p-4 space-y-3 animate-pulse">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Expert</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="px-4 py-2.5"><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-32 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-8 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-5 w-20 rounded-full bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No clients yet. Click <strong>Create New Client</strong> to get started.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border">
              {keys.map((k) => (
                <div
                  key={k.id}
                  className="p-4 space-y-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedClientId(k.id)}
                >
                  <div className="font-medium text-foreground">{k.name || "Unnamed"}</div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => { const ch = channelLabel(k.clientChannel, k.clientSubChannel); return ch ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span> : null; })()}
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${!k.isActive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : k.ipEvents?.some((e) => e.status === "allowed") ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"}`}>
                      {!k.isActive ? "Inactive" : k.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {(() => { const ps = expertStatus(k.expert); return <span className={ps.warning ? "text-orange-600" : ""}>{ps.label}</span>; })()}
                    <span>{k._count.requests} requests</span>
                    <span>{new Date(k.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Expert</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr
                    key={k.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedClientId(k.id)}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">{k.name || "Unnamed"}</td>
                    <td className="px-4 py-2.5">
                      {(() => { const ch = channelLabel(k.clientChannel, k.clientSubChannel); return ch ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const ps = expertStatus(k.expert);
                        return (
                          <div>
                            <span className={`text-sm ${ps.warning ? "text-foreground" : "text-muted-foreground"}`}>{ps.label}</span>
                            {ps.warning && <p className="mt-0.5 text-xs text-orange-600 dark:text-orange-400">{ps.warning}</p>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{k._count.requests}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${!k.isActive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : k.ipEvents?.some((e) => e.status === "allowed") ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"}`}>
                          {!k.isActive ? "Inactive" : k.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
                        </span>
                        {isInGracePeriod(k) && (
                          <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">Grace</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Supported channels */}
      <div className="mt-8">
        <h2 className="mb-1 text-sm font-medium text-muted-foreground">Supported channels</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Clients connect through these channels. Select one when creating a new client.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {[
            { label: "OpenClaw", icon: "/icons/openclaw.svg", active: true, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "Claude Code", icon: "/icons/claudecode.svg", active: true, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "Codex CLI", icon: "/icons/codex.svg", active: true, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "Custom", icon: null, active: true, Icon: Terminal as ComponentType<{ className?: string }> },
            { label: "Gemini CLI", icon: "/icons/gemini.svg", active: false, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "OpenAI", icon: "/icons/openai.svg", active: false, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "NanoClaw", icon: "/icons/docker.svg", active: false, Icon: null as ComponentType<{ className?: string }> | null },
            { label: "NemoClaw", icon: "/icons/nvidia.svg", active: false, Icon: null as ComponentType<{ className?: string }> | null },
          ].map((ch) => (
            <div
              key={ch.label}
              className={`flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 ${
                ch.active ? "" : "opacity-50"
              }`}
            >
              {ch.Icon ? (
                <ch.Icon className="h-7 w-7 rounded p-1 text-foreground" />
              ) : (
                <img src={ch.icon ?? ""} alt={ch.label} className="h-7 w-7 rounded" />
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{ch.label}</span>
                {ch.active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <Check className="h-2.5 w-2.5" /> Active
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
                    Soon
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client detail slide-in panel */}
      <Sheet open={!!selectedClientId} onOpenChange={(open) => { if (!open) setSelectedClientId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 overflow-hidden">
          <SheetHeader className="px-6 pt-5 pb-0">
            <SheetTitle>{keys.find((k) => k.id === selectedClientId)?.name || "Client details"}</SheetTitle>
            <SheetDescription className="sr-only">Client configuration and settings</SheetDescription>
          </SheetHeader>
          {selectedClientId && (
            <ClientDetailPanel
              clientId={selectedClientId}
              onClose={() => setSelectedClientId(null)}
              onDeleted={() => { setSelectedClientId(null); loadKeys(); }}
              onUpdated={() => loadKeys()}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
