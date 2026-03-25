"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AlertTriangle, Phone, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ProviderDetailPanel } from "@/components/dashboard/provider-detail-panel";
const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getTimezones(): string[] {
  if (typeof Intl !== "undefined" && "supportedValuesOf" in Intl) {
    try {
      return (
        Intl as unknown as { supportedValuesOf: (key: string) => string[] }
      ).supportedValuesOf("timeZone");
    } catch {
      // fallback
    }
  }
  return COMMON_TIMEZONES;
}

// ── Availability Panel component ────────────────────────────────────────────

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function AvailabilityPanel({
  enabled, onToggle, from, until, days, onFromChange, onUntilChange, onDaysChange,
}: {
  enabled: boolean;
  onToggle: () => void;
  from: string;
  until: string;
  days: number[];
  onFromChange: (v: string) => void;
  onUntilChange: (v: string) => void;
  onDaysChange: (v: number[]) => void;
}) {
  const toggleDay = (d: number) =>
    onDaysChange(days.includes(d) ? days.filter((x) => x !== d) : [...days, d]);

  return (
    <div className="mb-3 rounded-lg border border-border bg-background p-3">
      {/* Header row with toggle */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-foreground">Availability</p>
          <p className="text-xs text-muted-foreground">When you&apos;re available to receive messages</p>
        </div>
        {/* Bigger, clearer toggle */}
        <button
          type="button"
          onClick={onToggle}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
            enabled ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
          }`}
          aria-pressed={enabled}
        >
          <span className="sr-only">{enabled ? "Enabled" : "Disabled"}</span>
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${
              enabled ? "translate-x-5" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>

      {enabled && (
        <div className="space-y-3 mt-3">
          {/* Time range */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Hours</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-orange-500"
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="time"
                value={until}
                onChange={(e) => onUntilChange(e.target.value)}
                className="rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Weekday chips */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Days</p>
            <div className="flex gap-1">
              {DAYS_SHORT.map((label, i) => {
                const active = days.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    className={`flex h-8 w-9 items-center justify-center rounded-md text-xs font-medium transition-colors ${
                      active
                        ? "bg-orange-600 text-white"
                        : "border border-border bg-card text-muted-foreground hover:border-orange-400 hover:text-foreground"
                    }`}
                  >
                    {label.slice(0, 2)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Interfaces ───────────────────────────────────────────────────────────────

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface LinkedClient {
  id: string;
  name: string | null;
  clientChannel: string | null;
  clientSubChannel: string | null;
}

interface ChannelProvider {
  id: string;
  type: string;
  name: string;
  status: string;
  config: string;
}

interface Provider {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  timezone: string;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  availableDays: string | null;
  phoneFirst: boolean;
  ipEvents: IpEvent[];
  channelProviders: ChannelProvider[];
  _count: { apiKeys: number };
  apiKeys: LinkedClient[];
}

function getProviderStatus(
  p: Provider,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive) return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const telegramCh = p.channelProviders?.find((c) => c.type === "telegram");
  if (telegramCh) {
    if (telegramCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return telegramCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.channelProviders?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "—", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function ChannelBadge({ channel }: { channel: ChannelProvider }) {
  if (channel.type === "telegram") {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
        Telegram Bot
      </span>
    );
  }
  if (channel.type === "openclaw") {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
        OpenClaw
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {channel.type}
    </span>
  );
}

export default function ProvidersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wizardName, setWizardName] = useState("");
  const [wizardChannel, setWizardChannel] = useState<"openclaw" | "telegram" | null>(null);
  const [wizardBotToken, setWizardBotToken] = useState("");
  const [wizardCreating, setWizardCreating] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [wizardResult, setWizardResult] = useState<{ providerId: string; providerKey: string; channel: "openclaw" | "telegram" } | null>(null);
  const [tunnelActive, setTunnelActive] = useState<boolean | null>(null);

  const fetchTunnelStatus = useCallback(() => {
    fetch("/api/admin/tunnel/status").then(r => r.json()).then(d => setTunnelActive(d.accessible ?? false)).catch(() => setTunnelActive(false));
  }, []);

  useEffect(() => { fetchTunnelStatus(); }, [fetchTunnelStatus]);

  const loadProviders = () =>
    fetch("/api/providers")
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data) => { setProviders(data.providers || []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { loadProviders(); }, []);

  const openWizard = () => {
    setWizardStep(1);
    setWizardName("");
    setWizardChannel(null);
    setWizardBotToken("");
    setWizardError("");
    setWizardResult(null);
  };

  const closeWizard = () => {
    setWizardStep(0);
    setWizardResult(null);
  };

  const createProviderWizard = async () => {
    if (!wizardName.trim() || !wizardChannel) return;
    if (wizardChannel === "telegram" && !wizardBotToken.trim()) {
      setWizardError("Bot token is required for Telegram");
      return;
    }
    setWizardCreating(true);
    setWizardError("");

    const provRes = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wizardName.trim() }),
    });
    const provData = await provRes.json();
    const providerId: string = provData.provider?.id || provData.id;
    const providerKey: string = provData.provider?.key || provData.key;

    if (wizardChannel === "telegram") {
      const channelRes = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: providerId,
          type: "telegram",
          name: `${wizardName.trim()} — Telegram`,
          config: { botToken: wizardBotToken.trim() },
        }),
      });

      if (!channelRes.ok) {
        const err = await channelRes.json().catch(() => ({}));
        setWizardError(err.error || "Failed to connect Telegram bot");
        setWizardCreating(false);
        return;
      }
    }

    setWizardResult({ providerId, providerKey, channel: wizardChannel });
    setWizardCreating(false);
    setWizardStep(3);
    loadProviders();
  };

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const selectedProviderId = searchParams.get("id");
  const setSelectedProviderId = useCallback((id: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set("id", id);
    } else {
      params.delete("id");
    }
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : window.location.pathname, { scroll: false });
  }, [searchParams, router]);

  return (
    <div>
      {/* Provider wizard modal */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button onClick={closeWizard} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">✕</button>

            {/* Step 1 — Name + Channel */}
            {wizardStep === 1 && (
              <div>
                <h2 className="mb-1 text-lg font-semibold text-foreground">Add New Provider</h2>
                <p className="mb-5 text-sm text-muted-foreground">Choose how this provider receives help requests.</p>

                <div className="mb-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider name <span className="text-red-400">*</span></label>
                    <input
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      placeholder="e.g. Thomas — Support"
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Notification channel <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setWizardChannel("openclaw")}
                        className={`rounded-lg border p-4 text-left transition-colors ${wizardChannel === "openclaw" ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30" : "border-border hover:border-muted-foreground"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img src="/icons/openclaw.svg" alt="OpenClaw" className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          <span className="text-sm font-medium text-foreground">OpenClaw</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Receive in your existing OpenClaw chat</p>
                      </button>
                      <button
                        onClick={() => setWizardChannel("telegram")}
                        className={`rounded-lg border p-4 text-left transition-colors ${wizardChannel === "telegram" ? "border-blue-500 bg-blue-950/30" : "border-border hover:border-muted-foreground"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img src="/icons/telegram.svg" alt="Telegram" className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          <span className="text-sm font-medium text-foreground">Telegram Bot</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Dedicated bot — forward requests to a chat</p>
                      </button>
                    </div>
                  </div>

                  {wizardChannel === "telegram" && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">Bot token <span className="text-red-400">*</span></label>
                      <input
                        value={wizardBotToken}
                        onChange={(e) => setWizardBotToken(e.target.value)}
                        placeholder="123456789:ABCdef..."
                        className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Get a token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">@BotFather</a> on Telegram.
                      </p>
                      {tunnelActive === false && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span><strong>Public access required.</strong> <a href="/dashboard/settings" className="underline font-medium">Go to Settings → Public Access</a> to enable a tunnel first.</span>
                        </div>
                      )}
                      {tunnelActive === true && (
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                          <span>✅ Public access is active — webhooks will be registered automatically.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {wizardChannel === "openclaw" && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-300">
                      <p className="mb-1 font-medium">How OpenClaw works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-orange-700 dark:text-orange-400">
                        <li>A provider key will be generated after creation</li>
                        <li>Install the HeySummon provider skill from <a href="https://clawhub.ai/thomasansems/heysummon-provider" target="_blank" rel="noopener noreferrer" className="underline">clawhub.ai</a></li>
                        <li>Configure it with your provider key — done!</li>
                      </ol>
                    </div>
                  )}

                  {wizardError && <p className="text-sm text-red-500">{wizardError}</p>}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={closeWizard} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
                  <button
                    onClick={createProviderWizard}
                    disabled={wizardCreating || !wizardName.trim() || !wizardChannel || (wizardChannel === "telegram" && !wizardBotToken.trim())}
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {wizardCreating ? "Creating..." : "Create Provider"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Done */}
            {wizardStep === 3 && wizardResult && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <h2 className="text-lg font-semibold text-foreground">Provider created!</h2>
                </div>

                {wizardResult.channel === "openclaw" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Follow these steps to connect your OpenClaw agent:</p>
                    <div className="rounded-lg border border-border bg-black p-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 1 — Install the provider skill</p>
                        <code className="text-green-400">/skill install https://clawhub.ai/thomasansems/heysummon-provider</code>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 2 — Configure with your provider key</p>
                        <div className="flex items-center gap-2">
                          <code className="text-green-400 break-all">{wizardResult.providerKey}</code>
                          <button onClick={() => copyKey(wizardResult.providerKey)} className="shrink-0 text-orange-400 hover:text-orange-300">{copied === wizardResult.providerKey ? "Copied!" : "Copy"}</button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 3 — Start receiving requests</p>
                        <p className="text-zinc-400">Help requests will appear as messages in your OpenClaw chat.</p>
                      </div>
                    </div>
                  </div>
                )}

                {wizardResult.channel === "telegram" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Your Telegram bot is connected!</p>
                    <div className="rounded-lg border border-border bg-black p-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">How it works</p>
                        <p className="text-zinc-400">When a client sends a help request, your Telegram bot will forward it. Reply directly in Telegram to respond.</p>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Activate the bot</p>
                        <p className="text-zinc-400">Open your Telegram bot and send <code className="rounded bg-muted px-1 text-foreground">/start</code>.</p>
                      </div>
                    </div>
                    {!tunnelActive && (
                      <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span><strong>Action needed:</strong> Public access is not active yet. <a href="/dashboard/settings" className="underline font-medium">Go to Settings →</a></span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={closeWizard} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Providers</h1>
        <button
          onClick={openWizard}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Add New Provider
        </button>
      </div>

      <div className="overflow-visible rounded-lg border border-border bg-card">
        {loading ? (
          <>
            <div className="md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-border p-4 space-y-3 animate-pulse">
                  <div className="h-4 w-24 rounded bg-muted" />
                  <div className="h-4 w-36 rounded bg-muted" />
                  <div className="flex gap-4">
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
                  <th className="px-4 py-2.5 font-medium">Clients</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="px-4 py-2.5"><div className="h-4 w-24 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-8 rounded bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-5 w-16 rounded-full bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-5 w-20 rounded-full bg-muted" /></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No providers yet. Create one to get started.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border">
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="p-4 space-y-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedProviderId(p.id)}
                >
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    {p.name}
                    {p.phoneFirst && (
                      <Phone className="h-3.5 w-3.5 text-blue-500" aria-label="Phone-first enabled" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.channelProviders?.length > 0 ? <ChannelBadge channel={p.channelProviders[0]} /> : null}
                    {(() => { const s = getProviderStatus(p, tunnelActive); return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.colorClass}`}>{s.label}</span>; })()}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{p._count.apiKeys} clients</span>
                    <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Clients</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedProviderId(p.id)}
                  >
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        {p.name}
                        {p.phoneFirst && (
                          <Phone className="h-3.5 w-3.5 text-blue-500" aria-label="Phone-first enabled" />
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p._count.apiKeys}</td>
                    <td className="px-4 py-2.5">
                      {p.channelProviders?.length > 0
                        ? <ChannelBadge channel={p.channelProviders[0]} />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => { const s = getProviderStatus(p, tunnelActive); return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.colorClass}`}>{s.label}</span>; })()}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</td>
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
          Providers receive help requests through these channels. Select one when adding a new provider.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "OpenClaw", icon: "/icons/openclaw.svg", active: true },
            { label: "Telegram", icon: "/icons/telegram.svg", active: true },
            { label: "Slack", icon: "/icons/slack.svg", active: false },
            { label: "WhatsApp", icon: "/icons/whatsapp.svg", active: false },
          ].map((ch) => (
            <div
              key={ch.label}
              className={`flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 ${
                ch.active ? "" : "opacity-50"
              }`}
            >
              <img src={ch.icon} alt={ch.label} className="h-7 w-7 rounded" />
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

      {/* Provider detail slide-in panel */}
      <Sheet open={!!selectedProviderId} onOpenChange={(open) => { if (!open) setSelectedProviderId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 overflow-hidden">
          <SheetHeader className="px-6 pt-5 pb-0">
            <SheetTitle>{providers.find((p) => p.id === selectedProviderId)?.name || "Provider details"}</SheetTitle>
            <SheetDescription className="sr-only">Provider configuration and settings</SheetDescription>
          </SheetHeader>
          {selectedProviderId && (
            <ProviderDetailPanel
              providerId={selectedProviderId}
              onClose={() => setSelectedProviderId(null)}
              onDeleted={() => { setSelectedProviderId(null); loadProviders(); }}
              onUpdated={() => loadProviders()}
              tunnelAccessible={tunnelActive}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
