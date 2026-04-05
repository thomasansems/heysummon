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
import { ExpertDetailPanel } from "@/components/dashboard/expert-detail-panel";
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

interface ExpertChannel {
  id: string;
  type: string;
  name: string;
  status: string;
  config: string;
}

interface Expert {
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
  expertChannels: ExpertChannel[];
  _count: { apiKeys: number };
  apiKeys: LinkedClient[];
}

function getExpertStatus(
  p: Expert,
  tunnelAccessible: boolean | null,
): { label: string; colorClass: string } {
  if (!p.isActive) return { label: "Inactive", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };

  const webhookCh = p.expertChannels?.find((c) => c.type === "telegram" || c.type === "slack");
  if (webhookCh) {
    if (webhookCh.status === "connected" && tunnelAccessible === false) {
      return { label: "Unreachable", colorClass: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
    }
    return webhookCh.status === "connected"
      ? { label: "Connected", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "Not connected", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  if (p.expertChannels?.length > 0) {
    const hasBound = p.ipEvents?.some((e) => e.status === "allowed");
    return hasBound
      ? { label: "Bound", colorClass: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" }
      : { label: "No binding yet", colorClass: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" };
  }

  return { label: "—", colorClass: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" };
}

function ChannelBadge({ channel }: { channel: ExpertChannel }) {
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
  if (channel.type === "slack") {
    return (
      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
        Slack
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
      {channel.type}
    </span>
  );
}

export default function ExpertsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);

  // Wizard state
  const [wizardStep, setWizardStep] = useState<0 | 1 | 2 | 3>(0);
  const [wizardName, setWizardName] = useState("");
  const [wizardChannel, setWizardChannel] = useState<"openclaw" | "telegram" | "slack" | null>(null);
  const [wizardBotToken, setWizardBotToken] = useState("");
  const [wizardSlackBotToken, setWizardSlackBotToken] = useState("");
  const [wizardSlackSigningSecret, setWizardSlackSigningSecret] = useState("");
  const [wizardSlackChannelId, setWizardSlackChannelId] = useState("");
  const [wizardCreating, setWizardCreating] = useState(false);
  const [wizardError, setWizardError] = useState("");
  const [wizardResult, setWizardResult] = useState<{ expertId: string; expertKey: string; channel: "openclaw" | "telegram" | "slack"; webhookUrl?: string } | null>(null);
  const [tunnelActive, setTunnelActive] = useState<boolean | null>(null);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const fetchTunnelStatus = useCallback(() => {
    fetch("/api/admin/tunnel/status").then(r => r.json()).then(d => {
      setTunnelActive(d.accessible ?? false);
      setPublicUrl(d.publicUrl ?? null);
    }).catch(() => setTunnelActive(false));
  }, []);

  useEffect(() => { fetchTunnelStatus(); }, [fetchTunnelStatus]);

  const loadExperts = () =>
    fetch("/api/experts")
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data) => { setExperts(data.experts || []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { loadExperts(); }, []);

  const openWizard = () => {
    setWizardStep(1);
    setWizardName("");
    setWizardChannel(null);
    setWizardBotToken("");
    setWizardSlackBotToken("");
    setWizardSlackSigningSecret("");
    setWizardSlackChannelId("");
    setWizardError("");
    setWizardResult(null);
  };

  const closeWizard = () => {
    setWizardStep(0);
    setWizardResult(null);
  };

  const createExpertWizard = async () => {
    if (!wizardName.trim() || !wizardChannel) return;
    if (wizardChannel === "telegram" && !wizardBotToken.trim()) {
      setWizardError("Bot token is required for Telegram");
      return;
    }
    if (wizardChannel === "slack" && (!wizardSlackBotToken.trim() || !wizardSlackSigningSecret.trim() || !wizardSlackChannelId.trim())) {
      setWizardError("Bot token, signing secret, and channel ID are required for Slack");
      return;
    }
    setWizardCreating(true);
    setWizardError("");

    const expRes = await fetch("/api/experts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: wizardName.trim() }),
    });
    const expData = await expRes.json();
    const expertId: string = expData.expert?.id || expData.id;
    const expertKey: string = expData.expert?.key || expData.key;

    if (wizardChannel === "telegram") {
      const channelRes = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: expertId,
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

    let webhookUrl: string | undefined;

    if (wizardChannel === "slack") {
      const channelRes = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId: expertId,
          type: "slack",
          name: `${wizardName.trim()} — Slack`,
          config: {
            botToken: wizardSlackBotToken.trim(),
            signingSecret: wizardSlackSigningSecret.trim(),
            channelId: wizardSlackChannelId.trim(),
          },
        }),
      });

      if (!channelRes.ok) {
        const err = await channelRes.json().catch(() => ({}));
        setWizardError(err.error || "Failed to connect Slack channel");
        setWizardCreating(false);
        return;
      }

      const channelData = await channelRes.json();
      const heysummonChannelId = channelData.channel?.id;
      const channelStatus = channelData.channel?.status;
      const channelError = channelData.channel?.errorMessage;

      if (channelStatus === "error" && channelError) {
        setWizardError(channelError);
        setWizardCreating(false);
        return;
      }

      if (heysummonChannelId) {
        const base = publicUrl || window.location.origin;
        webhookUrl = `${base}/api/adapters/slack/${heysummonChannelId}/webhook`;
      }
    }

    setWizardResult({ expertId, expertKey, channel: wizardChannel, webhookUrl });
    setWizardCreating(false);
    setWizardStep(3);
    loadExperts();
  };

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const selectedExpertId = searchParams.get("id");
  const setSelectedExpertId = useCallback((id: string | null) => {
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
      {/* Expert wizard modal */}
      {wizardStep > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl">
            <button onClick={closeWizard} className="absolute right-4 top-4 text-muted-foreground hover:text-foreground">✕</button>

            {/* Step 1 — Name + Channel */}
            {wizardStep === 1 && (
              <div>
                <h2 className="mb-1 text-lg font-semibold text-foreground">Add New Expert</h2>
                <p className="mb-5 text-sm text-muted-foreground">Choose how this expert receives help requests.</p>

                <div className="mb-4 space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Expert name <span className="text-red-400">*</span></label>
                    <input
                      value={wizardName}
                      onChange={(e) => setWizardName(e.target.value)}
                      placeholder="e.g. Thomas — Support"
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-muted-foreground">Notification channel <span className="text-red-400">*</span></label>
                    <div className="grid grid-cols-3 gap-3">
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
                      <button
                        onClick={() => setWizardChannel("slack")}
                        className={`rounded-lg border p-4 text-left transition-colors ${wizardChannel === "slack" ? "border-purple-500 bg-purple-950/30" : "border-border hover:border-muted-foreground"}`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <img src="/icons/slack.svg" alt="Slack" className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display="none"; }} />
                          <span className="text-sm font-medium text-foreground">Slack</span>
                        </div>
                        <p className="text-xs text-muted-foreground">Receive requests in a Slack channel</p>
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

                  {wizardChannel === "slack" && (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/20 p-3 text-xs text-purple-700 dark:text-purple-300">
                        <p className="mb-1.5 font-medium">Setup steps:</p>
                        <ol className="list-decimal list-inside space-y-1.5 text-purple-700 dark:text-purple-400">
                          <li>
                            <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="underline">Create a Slack app</a> (From scratch)
                          </li>
                          <li>
                            Go to <strong>OAuth &amp; Permissions</strong> and add Bot Token Scopes: <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">chat:write</code>, <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">channels:read</code>, and <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">channels:history</code>
                          </li>
                          <li>Click <strong>Install to Workspace</strong> and copy the Bot token below</li>
                          <li>Copy the <strong>Signing Secret</strong> from Basic Information</li>
                          <li>Create a channel, invite the bot with <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">/invite @YourBot</code>, and copy the Channel ID</li>
                          <li>Go to <strong>Event Subscriptions</strong> and toggle it on (don&apos;t paste the URL yet)</li>
                          <li>Under <strong>Subscribe to bot events</strong>, add <code className="rounded bg-purple-100 dark:bg-purple-900/40 px-1">message.channels</code> and click Save</li>
                          <li>Click <strong>Create Expert</strong> below -- the Request URL to paste will be shown</li>
                        </ol>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Bot token <span className="text-red-400">*</span></label>
                        <input
                          value={wizardSlackBotToken}
                          onChange={(e) => setWizardSlackBotToken(e.target.value)}
                          placeholder="xoxb-..."
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Found under <strong>OAuth &amp; Permissions</strong> &gt; Bot User OAuth Token in your <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline">Slack app</a>.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Signing secret <span className="text-red-400">*</span></label>
                        <input
                          value={wizardSlackSigningSecret}
                          onChange={(e) => setWizardSlackSigningSecret(e.target.value)}
                          placeholder="abc123..."
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Found under <strong>Basic Information</strong> &gt; App Credentials &gt; Signing Secret.
                        </p>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">Channel ID <span className="text-red-400">*</span></label>
                        <input
                          value={wizardSlackChannelId}
                          onChange={(e) => setWizardSlackChannelId(e.target.value)}
                          placeholder="C0123456789"
                          className="w-full rounded-md border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Right-click a channel in Slack &gt; View channel details &gt; copy the Channel ID at the bottom.
                        </p>
                      </div>
                      {tunnelActive === false && (
                        <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span><strong>Public access required.</strong> <a href="/dashboard/settings" className="underline font-medium">Go to Settings</a> to enable a tunnel first.</span>
                        </div>
                      )}
                      {tunnelActive === true && (
                        <div className="flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
                          <span>Public access is active — webhooks will be registered automatically.</span>
                        </div>
                      )}
                    </div>
                  )}

                  {wizardChannel === "openclaw" && (
                    <div className="rounded-lg border border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 p-3 text-xs text-orange-700 dark:text-orange-300">
                      <p className="mb-1 font-medium">How OpenClaw works:</p>
                      <ol className="list-decimal list-inside space-y-1 text-orange-700 dark:text-orange-400">
                        <li>A expert key will be generated after creation</li>
                        <li>Install the HeySummon expert skill from <a href="https://clawhub.ai/thomasansems/heysummon-expert" target="_blank" rel="noopener noreferrer" className="underline">clawhub.ai</a></li>
                        <li>Configure it with your expert key — done!</li>
                      </ol>
                    </div>
                  )}

                  {wizardError && <p className="text-sm text-red-500">{wizardError}</p>}
                </div>

                <div className="flex justify-end gap-2">
                  <button onClick={closeWizard} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
                  <button
                    onClick={createExpertWizard}
                    disabled={wizardCreating || !wizardName.trim() || !wizardChannel || (wizardChannel === "telegram" && !wizardBotToken.trim()) || (wizardChannel === "slack" && (!wizardSlackBotToken.trim() || !wizardSlackSigningSecret.trim() || !wizardSlackChannelId.trim()))}
                    className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background disabled:opacity-40"
                  >
                    {wizardCreating ? "Creating..." : "Create Expert"}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3 — Done */}
            {wizardStep === 3 && wizardResult && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-2xl">✅</span>
                  <h2 className="text-lg font-semibold text-foreground">Expert created!</h2>
                </div>

                {wizardResult.channel === "openclaw" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Follow these steps to connect your OpenClaw agent:</p>
                    {/* intentionally dark — code/instruction block */}
                    <div className="rounded-lg border border-border bg-zinc-950 p-4 space-y-3 text-xs">
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 1 — Install the expert skill</p>
                        <code className="text-green-400">/skill install https://clawhub.ai/thomasansems/heysummon-expert</code>
                      </div>
                      <div>
                        <p className="mb-1 text-muted-foreground font-medium">Step 2 — Configure with your expert key</p>
                        <div className="flex items-center gap-2">
                          <code className="text-green-400 break-all">{wizardResult.expertKey}</code>
                          <button onClick={() => copyKey(wizardResult.expertKey)} className="shrink-0 text-orange-400 hover:text-orange-300">{copied === wizardResult.expertKey ? "Copied!" : "Copy"}</button>
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
                    {/* intentionally dark — code/instruction block */}
                    <div className="rounded-lg border border-border bg-zinc-950 p-4 space-y-3 text-xs">
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

                {wizardResult.channel === "slack" && (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">Your Slack channel is connected! Paste this URL in your Slack app under Event Subscriptions &gt; Request URL:</p>
                    {/* intentionally dark — code/instruction block */}
                    <div className="rounded-lg border border-border bg-zinc-950 p-4 text-xs">
                      {wizardResult.webhookUrl ? (
                        <div className="flex items-center gap-2">
                          <code className="text-green-400 break-all">{wizardResult.webhookUrl}</code>
                          <button onClick={() => copyKey(wizardResult.webhookUrl!)} className="shrink-0 text-orange-400 hover:text-orange-300">{copied === wizardResult.webhookUrl ? "Copied!" : "Copy"}</button>
                        </div>
                      ) : (
                        <p className="text-zinc-400">Webhook URL could not be determined. Check the channel details in the expert panel.</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After pasting, Slack will verify the URL automatically. Then reply to requests in the channel with <code className="rounded bg-muted px-1 text-foreground">reply HS-XXXX your answer</code> (no slash).
                    </p>
                    {!tunnelActive && (
                      <div className="flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2.5 text-xs text-orange-700 dark:text-orange-300">
                        <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                        <span><strong>Action needed:</strong> Public access is not active yet. <a href="/dashboard/settings" className="underline font-medium">Go to Settings →</a></span>
                      </div>
                    )}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button onClick={closeWizard} className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background">Done</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Experts</h1>
        <button
          onClick={openWizard}
          className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
        >
          Add New Expert
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
        ) : experts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No experts yet. Create one to get started.
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden divide-y divide-border">
              {experts.map((p) => (
                <div
                  key={p.id}
                  className="p-4 space-y-2 cursor-pointer hover:bg-muted/30"
                  onClick={() => setSelectedExpertId(p.id)}
                >
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    {p.name}
                    {p.phoneFirst && (
                      <Phone className="h-3.5 w-3.5 text-blue-500" aria-label="Phone-first enabled" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {p.expertChannels?.length > 0 ? <ChannelBadge channel={p.expertChannels[0]} /> : null}
                    {(() => { const s = getExpertStatus(p, tunnelActive); return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.colorClass}`}>{s.label}</span>; })()}
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
                {experts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-border last:border-0 cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedExpertId(p.id)}
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
                      {p.expertChannels?.length > 0
                        ? <ChannelBadge channel={p.expertChannels[0]} />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => { const s = getExpertStatus(p, tunnelActive); return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${s.colorClass}`}>{s.label}</span>; })()}
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
          Experts receive help requests through these channels. Select one when adding a new expert.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "OpenClaw", icon: "/icons/openclaw.svg", active: true },
            { label: "Telegram", icon: "/icons/telegram.svg", active: true },
            { label: "Slack", icon: "/icons/slack.svg", active: true },
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

      {/* Expert detail slide-in panel */}
      <Sheet open={!!selectedExpertId} onOpenChange={(open) => { if (!open) setSelectedExpertId(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[600px] p-0 overflow-hidden">
          <SheetHeader className="px-6 pt-5 pb-0">
            <SheetTitle>{experts.find((p) => p.id === selectedExpertId)?.name || "Expert details"}</SheetTitle>
            <SheetDescription className="sr-only">Expert configuration and settings</SheetDescription>
          </SheetHeader>
          {selectedExpertId && (
            <ExpertDetailPanel
              expertId={selectedExpertId}
              onClose={() => setSelectedExpertId(null)}
              onDeleted={() => { setSelectedExpertId(null); loadExperts(); }}
              onUpdated={() => loadExperts()}
              tunnelAccessible={tunnelActive}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
