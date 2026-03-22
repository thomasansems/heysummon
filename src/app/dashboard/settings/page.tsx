"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Globe, Wifi, WifiOff, Copy, Check, FlaskConical, ShieldCheck, AlertTriangle, Cloud } from "lucide-react";

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface ProviderProfile {
  id: string;
  name: string;
  key: string;
  ipEvents: IpEvent[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [notificationPref, setNotificationPref] = useState("email");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retention, setRetention] = useState<{
    retentionDays: number | null;
    enabled: boolean;
    stats: { totalRequests: number; expiredRequests: number; totalAuditLogs: number };
  } | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [providerProfiles, setProviderProfiles] = useState<ProviderProfile[]>([]);

  // Tunnel state
  const [tunnel, setTunnel] = useState<{
    accessible: boolean;
    active: boolean;
    method: "tailscale" | "cloudflared" | "custom" | "none";
    publicUrl: string | null;
    hostname: string | null;
    tailscaleAvailable: boolean;
    cloudflaredAvailable: boolean;
    needsOperatorSetup?: boolean;
  } | null>(null);
  const [tunnelLoading, setTunnelLoading] = useState(false);
  const [tunnelLoadingMethod, setTunnelLoadingMethod] = useState<"tailscale" | "cloudflared" | null>(null);
  const [tunnelError, setTunnelError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTunnelStatus = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/tunnel/status").then(r => r.json());
      setTunnel(data);
    } catch {}
  }, []);

  useEffect(() => { fetchTunnelStatus(); }, [fetchTunnelStatus]);

  const startTunnel = async () => {
    setTunnelLoading(true);
    setTunnelLoadingMethod("tailscale");
    setTunnelError(null);
    const res = await fetch("/api/admin/tunnel/start", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTunnelError(data.error ?? "Failed to start Tailscale Funnel");
    }
    await fetchTunnelStatus();
    setTunnelLoading(false);
    setTunnelLoadingMethod(null);
  };

  const stopTunnel = async () => {
    setTunnelLoading(true);
    setTunnelError(null);
    const res = await fetch("/api/admin/tunnel/stop", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTunnelError(data.error ?? "Failed to stop Tailscale Funnel");
    }
    await fetchTunnelStatus();
    setTunnelLoading(false);
  };

  const startCloudflared = async () => {
    setTunnelLoading(true);
    setTunnelLoadingMethod("cloudflared");
    setTunnelError(null);
    const res = await fetch("/api/admin/cloudflared/start", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTunnelError(data.error ?? "Failed to start Cloudflared Tunnel");
    }
    await fetchTunnelStatus();
    setTunnelLoading(false);
    setTunnelLoadingMethod(null);
  };

  const stopCloudflared = async () => {
    setTunnelLoading(true);
    setTunnelError(null);
    const res = await fetch("/api/admin/cloudflared/stop", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setTunnelError(data.error ?? "Failed to stop Cloudflared Tunnel");
    }
    await fetchTunnelStatus();
    setTunnelLoading(false);
  };

  const copyUrl = () => {
    const url = tunnel?.hostname ?? tunnel?.publicUrl;
    if (url) { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  // Test webhook state
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string; error?: string; webhooks?: { channel: string; ok: boolean; lastError?: string | null }[] } | null>(null);

  const testWebhook = async () => {
    setTestLoading(true);
    setTestResult(null);
    const res = await fetch("/api/admin/tunnel/test", { method: "POST" });
    const data = await res.json();
    setTestResult(data);
    setTestLoading(false);
  };

  const fetchProviderIpEvents = useCallback(() => {
    fetch("/api/providers/ip-events")
      .then((r) => r.json())
      .then((data) => setProviderProfiles(data.profiles || []))
      .catch(() => {});
  }, []);

  const updateIpStatus = async (eventId: string, status: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProviderIpEvents();
  };

  const deleteIpEvent = async (eventId: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, { method: "DELETE" });
    fetchProviderIpEvents();
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.notificationPref) setNotificationPref(data.notificationPref);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
      })
      .catch(() => {});

    fetch("/api/admin/retention")
      .then((r) => r.json())
      .then((data) => setRetention(data))
      .catch(() => {});

    fetchProviderIpEvents();
  }, [fetchProviderIpEvents]);

  const triggerCleanup = async () => {
    setCleanupRunning(true);
    setCleanupDone(false);
    await fetch("/api/admin/retention", { method: "POST" });
    const updated = await fetch("/api/admin/retention").then((r) => r.json());
    setRetention(updated);
    setCleanupRunning(false);
    setCleanupDone(true);
    setTimeout(() => setCleanupDone(false), 3000);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPref, telegramChatId }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold text-foreground">Settings</h1>

      {/* ── 1. Public Access ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Public Access</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-medium text-foreground">Public Access</h2>
          <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
            tunnel?.accessible
              ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300"
              : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
          }`}>
            {tunnel?.accessible
              ? `● ${tunnel.method === "tailscale" ? "Tailscale" : tunnel.method === "cloudflared" ? "Cloudflared" : "Custom"} · Active`
              : "○ Not accessible"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Required when receiving external messages (Telegram webhooks, consumer polling) while running on a local machine. Enable a tunnel to make your HeySummon instance reachable over HTTPS.
        </p>

        {/* Security explanation */}
        <div className="mb-4 rounded-md border border-border bg-muted/40 p-3 flex gap-2.5">
          <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
          <div className="text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Why this is safe</p>
            <p>Tunnels expose only the HeySummon port over HTTPS — equivalent to a cloud deployment. Your dashboard and API remain protected by session authentication.</p>
            <p>Telegram webhook requests are validated against a per-bot <strong>secret token</strong> (<code className="rounded bg-muted px-1 font-mono">x-telegram-bot-api-secret-token</code> header) — spoofed requests are rejected with 403.</p>
          </div>
        </div>

        {/* Active: show URL */}
        {tunnel?.accessible && (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 px-3 py-2">
            <span className="text-xs font-mono text-foreground flex-1 truncate">{tunnel.hostname ?? tunnel.publicUrl}</span>
            <button onClick={copyUrl} className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground" title="Copy URL">
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        {/* Tunnel action error */}
        {tunnelError && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{tunnelError}</span>
          </div>
        )}

        {/* Tailscale operator setup warning */}
        {tunnel?.needsOperatorSetup && (
          <div className="mb-4 flex items-start gap-2 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
            <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>First-time setup requires running <code className="rounded bg-orange-100 dark:bg-orange-950 px-1 font-mono">sudo tailscale set --operator=$USER</code> once in a terminal to allow non-root Funnel access.</span>
          </div>
        )}

        {/* Not accessible: show options */}
        {tunnel && !tunnel.accessible && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Tailscale option */}
            <div className={`rounded-md border p-3 ${tunnel.tailscaleAvailable ? "border-border" : "border-border opacity-60"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Tailscale Funnel</span>
                {!tunnel.tailscaleAvailable && <span className="ml-auto text-xs text-muted-foreground">Not installed</span>}
              </div>
              <p className="text-xs text-muted-foreground mb-2">Secure, identity-based tunnel via your Tailscale account.</p>
              {tunnel.tailscaleAvailable ? (
                <button
                  onClick={startTunnel}
                  disabled={tunnelLoading}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Wifi className="h-3.5 w-3.5" />
                  {tunnelLoading && tunnelLoadingMethod === "tailscale" ? "Starting…" : "Start Tailscale Funnel"}
                </button>
              ) : (
                <a href="https://tailscale.com/download" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">
                  Install Tailscale →
                </a>
              )}
            </div>

            {/* Cloudflared option */}
            <div className={`rounded-md border p-3 ${tunnel.cloudflaredAvailable ? "border-border" : "border-border opacity-60"}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Cloud className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-foreground">Cloudflared Tunnel</span>
                {!tunnel.cloudflaredAvailable && <span className="ml-auto text-xs text-muted-foreground">Not installed</span>}
              </div>
              <p className="text-xs text-muted-foreground mb-2">No-account quick tunnel via Cloudflare&apos;s network.</p>
              {tunnel.cloudflaredAvailable ? (
                <button
                  onClick={startCloudflared}
                  disabled={tunnelLoading}
                  className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Cloud className="h-3.5 w-3.5" />
                  {tunnelLoading && tunnelLoadingMethod === "cloudflared" ? "Starting…" : "Start Cloudflared Tunnel"}
                </button>
              ) : (
                <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">
                  Install cloudflared →
                </a>
              )}
            </div>
          </div>
        )}

        {/* Active controls */}
        {tunnel?.accessible && (
          <div className="flex flex-wrap gap-2">
            {tunnel.method === "tailscale" && (
              <button
                onClick={stopTunnel}
                disabled={tunnelLoading}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <WifiOff className="h-3.5 w-3.5" />
                Stop Funnel
              </button>
            )}
            {tunnel.method === "cloudflared" && (
              <button
                onClick={stopCloudflared}
                disabled={tunnelLoading}
                className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                <WifiOff className="h-3.5 w-3.5" />
                Stop Cloudflared
              </button>
            )}
            <button
              onClick={testWebhook}
              disabled={testLoading}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              title="Verify webhook URLs are reachable and correctly registered"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              {testLoading ? "Testing…" : "Test Webhooks"}
            </button>
          </div>
        )}

        {/* Test results */}
        {testResult && (
          <div className={`mt-3 rounded-md border p-3 text-xs ${testResult.ok ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300" : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300"}`}>
            <p className="font-medium mb-1">{testResult.message ?? testResult.error}</p>
            {testResult.webhooks && testResult.webhooks.map((w, i) => (
              <div key={i} className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span>{w.ok ? "✅" : "❌"}</span>
                <span className="font-mono">{w.channel}</span>
                {w.lastError && w.ok && (
                  <span className="text-muted-foreground italic">— (historical: {w.lastError})</span>
                )}
                {w.lastError && !w.ok && (
                  <span className="text-red-500 dark:text-red-400">— {w.lastError}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </section>

      {/* ── 2. Profile ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Profile</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-medium text-foreground">Profile</h2>
        <div className="flex items-center gap-4">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-lg font-medium text-foreground">
              {session?.user?.name?.[0] || "?"}
            </div>
          )}
          <div>
            <p className="font-medium text-foreground">
              {session?.user?.name || "—"}
            </p>
            <p className="text-sm text-muted-foreground">
              {session?.user?.email || "—"}
            </p>
          </div>
        </div>
      </div>
      </section>

      {/* ── 3. Notifications ── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Notifications</h2>
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-sm font-medium text-foreground">Preferences</h3>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-muted-foreground">
              Notification Preference
            </label>
            <select
              value={notificationPref}
              onChange={(e) => setNotificationPref(e.target.value)}
              className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
            >
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
              <option value="both">Both</option>
            </select>
          </div>
          {(notificationPref === "telegram" ||
            notificationPref === "both") && (
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Telegram Chat ID
              </label>
              <input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Your Telegram chat ID"
                className="w-full max-w-xs rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
          )}
        </div>
        <div className="mt-4 border-t border-border pt-4">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
          </button>
        </div>
      </div>
      </section>

      {/* ── 4. Data Retention ── */}
      {retention && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Data Retention</h2>
        <div className="rounded-lg border border-border bg-card p-6">
          <h3 className="mb-1 text-sm font-medium text-foreground">Cleanup Policy</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            {retention.enabled
              ? `Auto-cleanup enabled — records older than ${retention.retentionDays} days are removed.`
              : "Auto-cleanup disabled. Set HEYSUMMON_RETENTION_DAYS in your environment to enable."}
          </p>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-border p-3 text-center">
              <p className="text-lg font-medium text-foreground">{retention.stats.totalRequests}</p>
              <p className="text-xs text-muted-foreground">Total requests</p>
            </div>
            <div className="rounded-md border border-border p-3 text-center">
              <p className="text-lg font-medium text-foreground">{retention.stats.expiredRequests}</p>
              <p className="text-xs text-muted-foreground">Expired / closed</p>
            </div>
            <div className="rounded-md border border-border p-3 text-center">
              <p className="text-lg font-medium text-foreground">{retention.stats.totalAuditLogs}</p>
              <p className="text-xs text-muted-foreground">Audit log entries</p>
            </div>
          </div>

          {retention.enabled && (
            <button
              onClick={triggerCleanup}
              disabled={cleanupRunning}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {cleanupRunning ? "Cleaning up..." : cleanupDone ? "Done!" : "Run cleanup now"}
            </button>
          )}
        </div>
        </section>
      )}
    </div>
  );
}
