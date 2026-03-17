"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { Fragment, useEffect, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

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
  ipEvents: IpEvent[];
  _count: { apiKeys: number };
  apiKeys: LinkedClient[];
}

export default function ProvidersPage() {
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
    fetch("/api/admin/tunnel/status").then(r => r.json()).then(d => setTunnelActive(d.active ?? false)).catch(() => setTunnelActive(false));
  }, []);

  useEffect(() => { if (wizardChannel === "telegram") fetchTunnelStatus(); }, [wizardChannel, fetchTunnelStatus]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editTimezone, setEditTimezone] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");
  const [editAvailEnabled, setEditAvailEnabled] = useState(false);
  const [editAvailFrom, setEditAvailFrom] = useState("09:00");
  const [editAvailUntil, setEditAvailUntil] = useState("18:00");
  // Days: 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
  const [editAvailDays, setEditAvailDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [saving, setSaving] = useState(false);

  const timezones = getTimezones();

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

    // 1. Create provider
    const provRes = await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wizardName.trim() }),
    });
    const provData = await provRes.json();
    const providerId: string = provData.provider?.id || provData.id;
    const providerKey: string = provData.provider?.key || provData.key;

    // 2. Create channel (Telegram only — OpenClaw channel is auto-created when the skill connects)
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

  const toggleProvider = async (id: string, isActive: boolean) => {
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadProviders();
  };

  const renameProvider = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    setEditingId(null);
    setEditName("");
    loadProviders();
  };

  const unlinkClient = async (keyId: string) => {
    await fetch(`/api/v1/keys/${keyId}/unlink`, { method: "POST" });
    loadProviders();
  };

  const deleteProvider = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?\n\nAll linked clients will be unlinked. This cannot be undone.`)) return;
    await fetch(`/api/providers/${id}`, { method: "DELETE" });
    loadProviders();
  };

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 12) + "•".repeat(16) + key.slice(-4);

  const openSettings = (p: Provider) => {
    setSettingsId(settingsId === p.id ? null : p.id);
    if (settingsId !== p.id) {
      setEditTimezone(p.timezone || "UTC");
      const hasAvail = !!(p.quietHoursStart || p.quietHoursEnd || p.availableDays);
      setEditAvailEnabled(hasAvail);
      setEditAvailFrom(p.quietHoursStart || "09:00");
      setEditAvailUntil(p.quietHoursEnd || "18:00");
      setEditAvailDays(p.availableDays ? p.availableDays.split(",").map(Number) : [1, 2, 3, 4, 5]);
    }
    setTimezoneFilter("");
  };

  const saveProviderSettings = async (id: string) => {
    setSaving(true);
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timezone: editTimezone,
        quietHoursStart: editAvailEnabled ? editAvailFrom : null,
        quietHoursEnd: editAvailEnabled ? editAvailUntil : null,
        availableDays: editAvailEnabled ? editAvailDays.sort((a, b) => a - b).join(",") : null,
      }),
    });
    setSaving(false);
    loadProviders();
  };

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
                      {/* OpenClaw */}
                      <button
                        onClick={() => setWizardChannel("openclaw")}
                        className={`rounded-lg border p-4 text-left transition-colors ${wizardChannel === "openclaw" ? "border-orange-600 bg-orange-100/80 dark:bg-orange-950/30" : "border-border hover:border-muted-foreground"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img src="/icons/openclaw.svg" alt="OpenClaw" className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          <span className="text-sm font-medium text-foreground">OpenClaw</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Receive in your existing OpenClaw chat (Telegram or WhatsApp)</p>
                      </button>

                      {/* Telegram Bot */}
                      <button
                        onClick={() => setWizardChannel("telegram")}
                        className={`rounded-lg border p-4 text-left transition-colors ${wizardChannel === "telegram" ? "border-blue-500 bg-blue-950/30" : "border-border hover:border-muted-foreground"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img src="/icons/telegram.svg" alt="Telegram" className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          <span className="text-sm font-medium text-foreground">Telegram Bot</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Dedicated Telegram bot — forward requests directly to a chat</p>
                      </button>
                    </div>
                  </div>

                  {/* Telegram bot token */}
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
                        Get a token from <a href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">@BotFather</a> on Telegram. Send <code className="rounded bg-muted px-1">/newbot</code> and copy the token.
                      </p>

                      {/* Tunnel warning */}
                      {tunnelActive === false && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>
                            <strong>Public access required.</strong> Telegram bot webhooks need a public HTTPS URL to deliver messages to your local server.{" "}
                            <a href="/dashboard/settings" className="underline font-medium">Go to Settings → Public Access</a> to enable Tailscale Funnel first.
                          </span>
                        </div>
                      )}
                      {tunnelActive === true && (
                        <div className="mt-3 flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                          <span>✅</span>
                          <span>Tailscale Funnel is active — webhooks will be registered automatically.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* OpenClaw info */}
                  {wizardChannel === "openclaw" && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-300">
                      <p className="mb-1 font-medium">How OpenClaw works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-orange-700 dark:text-orange-400">
                        <li>A provider key will be generated after creation</li>
                        <li>Install the HeySummon provider skill from <a href="https://clawhub.ai/thomasansems/heysummon-provider" target="_blank" rel="noopener noreferrer" className="underline">clawhub.ai</a></li>
                        <li>Configure it with your provider key — done!</li>
                      </ol>
                      <p className="mt-2 text-orange-500">Help requests will arrive as messages in your OpenClaw chat (Telegram or WhatsApp).</p>
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
                    <p className="text-sm text-muted-foreground">
                      Follow these steps to connect your OpenClaw agent:
                    </p>
                    <div className="rounded-lg border border-border bg-black p-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 1 — Install the provider skill</p>
                        <p className="text-zinc-400 mb-1">In your OpenClaw chat (Telegram or WhatsApp), run:</p>
                        <code className="text-green-400">/skill install https://clawhub.ai/thomasansems/heysummon-provider</code>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 2 — Configure with your provider key</p>
                        <p className="text-zinc-400 mb-1">Your provider key:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-green-400 break-all">{wizardResult.providerKey}</code>
                          <button onClick={() => { copyToClipboard(wizardResult.providerKey); setCopied(wizardResult.providerKey); setTimeout(() => setCopied(null), 2000); }} className="shrink-0 text-orange-400 hover:text-orange-300">{copied === wizardResult.providerKey ? "Copied!" : "Copy"}</button>
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 3 — Start receiving requests</p>
                        <p className="text-zinc-400">Help requests will appear as messages in your OpenClaw chat. Reply to respond.</p>
                      </div>
                    </div>
                  </div>
                )}

                {wizardResult.channel === "telegram" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Your Telegram bot is connected! Here&apos;s what happens next:</p>
                    <div className="rounded-lg border border-border bg-black p-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">How it works</p>
                        <p className="text-zinc-400">When a client sends a help request, your Telegram bot will forward it with inline approve/decline buttons. Reply directly in Telegram to respond.</p>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Activate the bot</p>
                        <p className="text-zinc-400">Open your Telegram bot and send <code className="rounded bg-muted px-1 text-foreground">/start</code> — the bot will bind to your chat ID automatically.</p>
                      </div>
                    </div>
                    {!tunnelActive && (
                      <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span>
                          <strong>Action needed:</strong> Tailscale Funnel is not active yet. The bot won&apos;t receive messages until you enable it.{" "}
                          <a href="/dashboard/settings" className="underline font-medium">Go to Settings → Public Access →</a>
                        </span>
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
          {/* Mobile loading skeleton */}
          <div className="md:hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-border p-4 space-y-3 animate-pulse">
                <div className="h-4 w-24 rounded bg-muted" />
                <div className="h-4 w-36 rounded bg-muted" />
                <div className="flex gap-4">
                  <div className="h-4 w-8 rounded bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
          {/* Desktop loading skeleton */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">User Key</th>
                <th className="px-4 py-2.5 font-medium">Clients</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td className="px-4 py-2.5"><div className="h-4 w-24 rounded bg-muted" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-36 rounded bg-muted" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-8 rounded bg-muted" /></td>
                  <td className="px-4 py-2.5"><div className="h-5 w-16 rounded-full bg-muted" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted" /></td>
                  <td className="px-4 py-2.5 text-right"><div className="ml-auto h-6 w-8 rounded bg-muted" /></td>
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
          <div className="md:hidden">
            {providers.map((p) => (
              <Fragment key={p.id}>
                <div className="border-b border-border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-foreground">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameProvider(p.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-32 rounded border border-border px-2 py-0.5 text-sm outline-none focus:border-ring"
                            autoFocus
                          />
                          <button onClick={() => renameProvider(p.id)} className="text-xs text-green-600">✓</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">✕</button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline"
                          onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                          title="Click to rename"
                        >
                          {p.name}
                        </span>
                      )}
                    </div>
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                        className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        ⋯
                      </button>
                      {openMenuId === p.id && (
                        <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
                          <button
                            onClick={() => { openSettings(p); setOpenMenuId(null); }}
                            className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                          >
                            Settings
                          </button>
                          {p.isActive ? (
                            <button
                              onClick={() => { toggleProvider(p.id, false); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-muted hover:text-red-400"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => { toggleProvider(p.id, true); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-muted hover:text-green-800"
                            >
                              Activate
                            </button>
                          )}
                          <div className="my-1 border-t border-border" />
                          <button
                            onClick={() => { deleteProvider(p.id, p.name); setOpenMenuId(null); }}
                            className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">User Key</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-muted-foreground break-all">{masked(p.key)}</code>
                      <button
                        onClick={() => copyKey(p.key)}
                        className="shrink-0 text-xs text-orange-600 hover:text-orange-800"
                      >
                        {copied === p.key ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div>
                      <span className="text-xs text-muted-foreground">Clients</span>
                      <div className="text-sm text-muted-foreground">{p._count.apiKeys}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">IP Status</span>
                      <div>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            !p.isActive
                              ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                              : p.ipEvents?.some((e) => e.status === "allowed")
                                ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                          }`}
                        >
                          {!p.isActive
                            ? "Inactive"
                            : p.ipEvents?.some((e) => e.status === "allowed")
                              ? "Bound"
                              : "No binding yet"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs text-muted-foreground">Created</span>
                    <div className="text-sm text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>

                {/* Settings inline panel (mobile) */}
                {settingsId === p.id && (
                  <div className="border-b border-border bg-muted px-4 py-3">
                    {/* Timezone */}
                    <div className="mb-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Timezone</p>
                      <select
                        value={editTimezone}
                        onChange={(e) => setEditTimezone(e.target.value)}
                        className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                      >
                        {timezones.map((tz) => (
                          <option key={tz} value={tz}>{tz}</option>
                        ))}
                      </select>
                    </div>

                    {/* Availability */}
                    <AvailabilityPanel
                      enabled={editAvailEnabled}
                      onToggle={() => setEditAvailEnabled((v) => !v)}
                      from={editAvailFrom}
                      until={editAvailUntil}
                      days={editAvailDays}
                      onFromChange={setEditAvailFrom}
                      onUntilChange={setEditAvailUntil}
                      onDaysChange={setEditAvailDays}
                    />

                    <button
                      onClick={() => saveProviderSettings(p.id)}
                      disabled={saving}
                      className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 mb-3"
                    >
                      {saving ? "Saving..." : "Save"}
                    </button>

                    {/* Linked Clients Section */}
                    <div className="border-t border-border pt-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        Linked Clients ({p.apiKeys?.length ?? 0})
                      </p>
                      {!p.apiKeys?.length ? (
                        <p className="text-xs text-muted-foreground">No clients linked to this provider.</p>
                      ) : (
                        <div className="space-y-1">
                          {p.apiKeys.map((client) => (
                            <div key={client.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                              <div className="flex items-center gap-2 text-xs">
                                <span className="font-medium text-foreground">{client.name || "Unnamed"}</span>
                                {client.clientChannel && (
                                  <span className="text-muted-foreground">
                                    {client.clientChannel === "claudecode" ? "Claude Code" :
                                      client.clientChannel === "openclaw" && client.clientSubChannel === "whatsapp" ? "OpenClaw · WhatsApp" :
                                      "OpenClaw · Telegram"}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Unlink "${client.name || "Unnamed"}" from this provider?`)) {
                                    unlinkClient(client.id);
                                  }
                                }}
                                className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded px-1.5 py-0.5 transition-colors"
                              >
                                Unlink
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* IP Security Section */}
                    <div className="border-t border-border pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">IP Security</p>
                        {p.ipEvents?.length > 0 && (
                          <button
                            onClick={async () => {
                              if (!window.confirm("Reset all IP bindings for this provider? The next request will bind a new IP.")) return;
                              await Promise.all(
                                p.ipEvents.map((evt) =>
                                  fetch(`/api/providers/ip-events/${evt.id}`, { method: "DELETE" })
                                )
                              );
                              loadProviders();
                            }}
                            className="rounded-md border border-red-800 px-2 py-0.5 text-xs text-red-600 hover:bg-red-950/40"
                          >
                            Reset All Bindings
                          </button>
                        )}
                      </div>

                      {!p.ipEvents || p.ipEvents.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No IP bindings yet. The first API request from this provider will automatically bind its IP.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-muted-foreground">
                                <th className="pb-1 pr-4 font-medium">IP Address</th>
                                <th className="pb-1 pr-4 font-medium">Status</th>
                                <th className="pb-1 pr-4 font-medium">Attempts</th>
                                <th className="pb-1 pr-4 font-medium">First Seen</th>
                                <th className="pb-1 pr-4 font-medium">Last Seen</th>
                                <th className="pb-1 font-medium" />
                              </tr>
                            </thead>
                            <tbody>
                              {p.ipEvents.map((evt) => (
                                <tr key={evt.id} className="border-t border-border">
                                  <td className="py-1.5 pr-4 font-mono text-muted-foreground">{evt.ip}</td>
                                  <td className="py-1.5 pr-4">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                        evt.status === "allowed"
                                          ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                                          : evt.status === "pending"
                                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                            : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                      }`}
                                    >
                                      {evt.status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{evt.attempts}</td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{new Date(evt.firstSeen).toLocaleString()}</td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{new Date(evt.lastSeen).toLocaleString()}</td>
                                  <td className="py-1.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      {evt.status !== "allowed" && (
                                        <button
                                          onClick={async () => {
                                            await fetch(`/api/providers/ip-events/${evt.id}`, {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ status: "allowed" }),
                                            });
                                            loadProviders();
                                          }}
                                          className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50"
                                        >
                                          Allow
                                        </button>
                                      )}
                                      {evt.status !== "blacklisted" && (
                                        <button
                                          onClick={async () => {
                                            await fetch(`/api/providers/ip-events/${evt.id}`, {
                                              method: "PATCH",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({ status: "blacklisted" }),
                                            });
                                            loadProviders();
                                          }}
                                          className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                                        >
                                          Blacklist
                                        </button>
                                      )}
                                      <button
                                        onClick={async () => {
                                          await fetch(`/api/providers/ip-events/${evt.id}`, { method: "DELETE" });
                                          loadProviders();
                                        }}
                                        className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-[#f0f0f0] hover:text-muted-foreground"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>

          {/* Desktop table view */}
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">User Key</th>
                <th className="px-4 py-2.5 font-medium">Clients</th>
                <th className="px-4 py-2.5 font-medium">IP Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <Fragment key={p.id}>
                  <tr className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 font-medium text-foreground">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameProvider(p.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-32 rounded border border-border px-2 py-0.5 text-sm outline-none focus:border-ring"
                            autoFocus
                          />
                          <button onClick={() => renameProvider(p.id)} className="text-xs text-green-600">✓</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">✕</button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:underline"
                          onClick={() => { setEditingId(p.id); setEditName(p.name); }}
                          title="Click to rename"
                        >
                          {p.name}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-muted-foreground">{masked(p.key)}</code>
                        <button
                          onClick={() => copyKey(p.key)}
                          className="text-xs text-orange-600 hover:text-orange-800"
                        >
                          {copied === p.key ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-muted-foreground">{p._count.apiKeys}</td>

                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          !p.isActive
                            ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                            : p.ipEvents?.some((e) => e.status === "allowed")
                              ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                              : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
                        }`}
                      >
                        {!p.isActive
                          ? "Inactive"
                          : p.ipEvents?.some((e) => e.status === "allowed")
                            ? "Bound"
                            : "No binding yet"}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          ⋯
                        </button>
                        {openMenuId === p.id && (
                          <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
                            <button
                              onClick={() => { openSettings(p); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              Settings
                            </button>
                            {p.isActive ? (
                              <button
                                onClick={() => { toggleProvider(p.id, false); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-muted hover:text-red-400"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => { toggleProvider(p.id, true); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-muted hover:text-green-800"
                              >
                                Activate
                              </button>
                            )}
                            <div className="my-1 border-t border-border" />
                            <button
                              onClick={() => { deleteProvider(p.id, p.name); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Settings inline panel */}
                  {settingsId === p.id && (
                    <tr key={`${p.id}-settings`} className="border-b border-border">
                      <td colSpan={6} className="bg-muted px-4 py-3">
                        {/* Timezone */}
                        <div className="mb-3">
                          <p className="mb-1 text-xs font-medium text-muted-foreground">Timezone</p>
                          <select
                            value={editTimezone}
                            onChange={(e) => setEditTimezone(e.target.value)}
                            className="max-w-xs rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                          >
                            {timezones.map((tz) => (
                              <option key={tz} value={tz}>{tz}</option>
                            ))}
                          </select>
                        </div>

                        {/* Availability */}
                        <AvailabilityPanel
                          enabled={editAvailEnabled}
                          onToggle={() => setEditAvailEnabled((v) => !v)}
                          from={editAvailFrom}
                          until={editAvailUntil}
                          days={editAvailDays}
                          onFromChange={setEditAvailFrom}
                          onUntilChange={setEditAvailUntil}
                          onDaysChange={setEditAvailDays}
                        />

                        <button
                          onClick={() => saveProviderSettings(p.id)}
                          disabled={saving}
                          className="max-w-xs rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 mb-3"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>

                        {/* Linked Clients Section */}
                        <div className="border-t border-border pt-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">
                            Linked Clients ({p.apiKeys?.length ?? 0})
                          </p>
                          {!p.apiKeys?.length ? (
                            <p className="text-xs text-muted-foreground">No clients linked to this provider.</p>
                          ) : (
                            <div className="space-y-1">
                              {p.apiKeys.map((client) => (
                                <div key={client.id} className="flex items-center justify-between rounded-md border border-border px-3 py-1.5">
                                  <div className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-foreground">{client.name || "Unnamed"}</span>
                                    {client.clientChannel && (
                                      <span className="text-muted-foreground">
                                        {client.clientChannel === "claudecode" ? "Claude Code" :
                                          client.clientChannel === "openclaw" && client.clientSubChannel === "whatsapp" ? "OpenClaw · WhatsApp" :
                                          "OpenClaw · Telegram"}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Unlink "${client.name || "Unnamed"}" from this provider?`)) {
                                        unlinkClient(client.id);
                                      }
                                    }}
                                    className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded px-1.5 py-0.5 transition-colors"
                                  >
                                    Unlink
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* IP Security Section */}
                        <div className="border-t border-border pt-3">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-medium text-muted-foreground">IP Security</p>
                            {p.ipEvents?.length > 0 && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Reset all IP bindings for this provider? The next request will bind a new IP.")) return;
                                  await Promise.all(
                                    p.ipEvents.map((evt) =>
                                      fetch(`/api/providers/ip-events/${evt.id}`, { method: "DELETE" })
                                    )
                                  );
                                  loadProviders();
                                }}
                                className="rounded-md border border-red-800 px-2 py-0.5 text-xs text-red-600 hover:bg-red-950/40"
                              >
                                Reset All Bindings
                              </button>
                            )}
                          </div>

                          {!p.ipEvents || p.ipEvents.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No IP bindings yet. The first API request from this provider will automatically bind its IP.
                            </p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="pb-1 pr-4 font-medium">IP Address</th>
                                  <th className="pb-1 pr-4 font-medium">Status</th>
                                  <th className="pb-1 pr-4 font-medium">Attempts</th>
                                  <th className="pb-1 pr-4 font-medium">First Seen</th>
                                  <th className="pb-1 pr-4 font-medium">Last Seen</th>
                                  <th className="pb-1 font-medium" />
                                </tr>
                              </thead>
                              <tbody>
                                {p.ipEvents.map((evt) => (
                                  <tr key={evt.id} className="border-t border-border">
                                    <td className="py-1.5 pr-4 font-mono text-muted-foreground">{evt.ip}</td>
                                    <td className="py-1.5 pr-4">
                                      <span
                                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                          evt.status === "allowed"
                                            ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                                            : evt.status === "pending"
                                              ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                              : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                                        }`}
                                      >
                                        {evt.status}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">{evt.attempts}</td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">{new Date(evt.firstSeen).toLocaleString()}</td>
                                    <td className="py-1.5 pr-4 text-muted-foreground">{new Date(evt.lastSeen).toLocaleString()}</td>
                                    <td className="py-1.5 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        {evt.status !== "allowed" && (
                                          <button
                                            onClick={async () => {
                                              await fetch(`/api/providers/ip-events/${evt.id}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "allowed" }),
                                              });
                                              loadProviders();
                                            }}
                                            className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50"
                                          >
                                            Allow
                                          </button>
                                        )}
                                        {evt.status !== "blacklisted" && (
                                          <button
                                            onClick={async () => {
                                              await fetch(`/api/providers/ip-events/${evt.id}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "blacklisted" }),
                                              });
                                              loadProviders();
                                            }}
                                            className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                                          >
                                            Blacklist
                                          </button>
                                        )}
                                        <button
                                          onClick={async () => {
                                            await fetch(`/api/providers/ip-events/${evt.id}`, { method: "DELETE" });
                                            loadProviders();
                                          }}
                                          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-[#f0f0f0] hover:text-muted-foreground"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}
