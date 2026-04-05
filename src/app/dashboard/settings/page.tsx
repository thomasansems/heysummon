"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";
import { Globe, Wifi, WifiOff, Copy, Check, FlaskConical, ShieldCheck, AlertTriangle, Cloud, Shield, Download, Trash2, Users } from "lucide-react";

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface ExpertProfile {
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
  const [expertProfiles, setExpertProfiles] = useState<ExpertProfile[]>([]);

  // GDPR state
  const [gdpr, setGdpr] = useState<{
    enabled: boolean;
    anonymizeIps: boolean;
    retentionDays: number;
    requireConsent: boolean;
    allowDataExport: boolean;
    allowDataDeletion: boolean;
    privacyPolicyUrl: string | null;
  } | null>(null);
  const [gdprSaving, setGdprSaving] = useState(false);
  const [gdprSaved, setGdprSaved] = useState(false);
  const [gdprRetentionInput, setGdprRetentionInput] = useState("90");
  const [gdprPolicyUrl, setGdprPolicyUrl] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [consent, setConsent] = useState<{
    gdprEnabled: boolean;
    consents: { type: string; granted: boolean; grantedAt: string | null; revokedAt: string | null }[];
  } | null>(null);
  const [consentSaving, setConsentSaving] = useState<string | null>(null);

  // Entity export state
  const [entityExportTarget, setEntityExportTarget] = useState("");
  const [entityExportLoading, setEntityExportLoading] = useState(false);
  const [entityExportDone, setEntityExportDone] = useState(false);
  const [exportEntities, setExportEntities] = useState<{ type: string; id: string; label: string }[]>([]);

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
    } catch { /* non-fatal */ }
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

  const fetchExpertIpEvents = useCallback(() => {
    fetch("/api/experts/ip-events")
      .then((r) => r.json())
      .then((data) => setExpertProfiles(data.profiles || []))
      .catch(() => {});
  }, []);

  const updateIpStatus = async (eventId: string, status: string) => {
    await fetch(`/api/experts/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchExpertIpEvents();
  };

  const deleteIpEvent = async (eventId: string) => {
    await fetch(`/api/experts/ip-events/${eventId}`, { method: "DELETE" });
    fetchExpertIpEvents();
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

    fetch("/api/admin/gdpr")
      .then((r) => r.json())
      .then((data) => {
        setGdpr(data);
        setGdprRetentionInput(String(data.retentionDays ?? 90));
        setGdprPolicyUrl(data.privacyPolicyUrl ?? "");
      })
      .catch(() => {});

    fetch("/api/gdpr/consent")
      .then((r) => r.json())
      .then((data) => setConsent(data))
      .catch(() => {});

    // Fetch experts + clients for entity export selector
    fetch("/api/experts")
      .then((r) => r.json())
      .then((data) => {
        const entities: { type: string; id: string; label: string }[] = [];
        for (const p of data.experts || []) {
          entities.push({ type: "expert", id: p.id, label: `Expert: ${p.name}` });
          for (const k of p.apiKeys || []) {
            entities.push({ type: "client", id: k.id, label: `Client: ${k.name || "Unnamed"}` });
          }
        }
        setExportEntities(entities);
      })
      .catch(() => {});

    fetchExpertIpEvents();
  }, [fetchExpertIpEvents]);

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

  const saveGdpr = async (updates: Record<string, unknown>) => {
    setGdprSaving(true);
    setGdprSaved(false);
    const res = await fetch("/api/admin/gdpr", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      const data = await res.json();
      setGdpr(data);
      setGdprRetentionInput(String(data.retentionDays));
      setGdprPolicyUrl(data.privacyPolicyUrl ?? "");
      // Refresh retention display since GDPR may override it
      fetch("/api/admin/retention").then(r => r.json()).then(d => setRetention(d)).catch(() => {});
    }
    setGdprSaving(false);
    setGdprSaved(true);
    setTimeout(() => setGdprSaved(false), 2000);
  };

  const toggleGdpr = (field: string, currentValue: boolean) => {
    saveGdpr({ [field]: !currentValue });
  };

  const exportMyData = async () => {
    setExportLoading(true);
    setExportDone(false);
    const res = await fetch("/api/gdpr/my-data");
    if (res.ok) {
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heysummon-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    }
    setExportLoading(false);
  };

  const exportEntityData = async () => {
    if (!entityExportTarget) return;
    setEntityExportLoading(true);
    setEntityExportDone(false);
    const [type, id] = entityExportTarget.split(":");
    const res = await fetch("/api/admin/gdpr/export-entity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id }),
    });
    if (res.ok) {
      const data = await res.json();
      const entity = exportEntities.find((e) => `${e.type}:${e.id}` === entityExportTarget);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `heysummon-${type}-export-${entity?.label.replace(/[^a-zA-Z0-9]/g, "-") || id}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setEntityExportDone(true);
      setTimeout(() => setEntityExportDone(false), 3000);
    }
    setEntityExportLoading(false);
  };

  const updateConsent = async (consentType: string, granted: boolean) => {
    setConsentSaving(consentType);
    await fetch("/api/gdpr/consent", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ consentType, granted }),
    });
    const updated = await fetch("/api/gdpr/consent").then(r => r.json());
    setConsent(updated);
    setConsentSaving(null);
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

      {/* ── 5. GDPR Compliance ── */}
      {gdpr && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">GDPR Compliance</h2>
          <div className="space-y-4">
            {/* Main GDPR toggle */}
            <div className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-serif text-base font-semibold text-foreground">GDPR Mode</h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleGdpr("enabled", gdpr.enabled)}
                  disabled={gdprSaving}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                    gdpr.enabled ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                  }`}
                  aria-pressed={gdpr.enabled}
                >
                  <span className="sr-only">{gdpr.enabled ? "Enabled" : "Disabled"}</span>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${gdpr.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Enable GDPR compliance for EU users. This activates IP anonymization in audit logs, configurable data retention, user consent management, and data export/deletion rights.
              </p>

              {gdpr.enabled && (
                <div className="rounded-md border border-border bg-muted/40 p-3 flex gap-2.5">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-green-500" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">GDPR protections active</p>
                    <p>IP addresses in audit logs are anonymized (last octet zeroed). Device-binding IPs remain intact for security (legitimate interest under Art. 6(1)(f)).</p>
                    <p>Data retention is enforced at <strong>{gdpr.retentionDays} days</strong>. Users can export and delete their data.</p>
                  </div>
                </div>
              )}
            </div>

            {/* GDPR Settings (only when enabled) */}
            {gdpr.enabled && (
              <>
                {/* Data Protection Settings */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-serif text-base font-semibold text-foreground mb-4">Data Protection Settings</h3>
                  <div className="space-y-5">
                    {/* IP Anonymization toggle */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">IP Anonymization</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Zeroes the last octet of IPv4 addresses (e.g. 192.168.1.105 becomes 192.168.1.0) and the last 80 bits of IPv6 addresses in all audit logs. Device-binding IPs remain intact as they are necessary for security under GDPR Art. 6(1)(f) — legitimate interest.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGdpr("anonymizeIps", gdpr.anonymizeIps)}
                        disabled={gdprSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                          gdpr.anonymizeIps ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                        }`}
                        aria-pressed={gdpr.anonymizeIps}
                      >
                        <span className="sr-only">{gdpr.anonymizeIps ? "Enabled" : "Disabled"}</span>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${gdpr.anonymizeIps ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    {/* Require Consent toggle */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Require User Consent</p>
                        <p className="text-xs text-muted-foreground mt-0.5">When enabled, users must explicitly opt-in before their data is processed. Required by GDPR Art. 7 — consent must be freely given, specific, informed, and unambiguous. Without this toggle, data processing relies on legitimate interest (Art. 6(1)(f)) instead.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGdpr("requireConsent", gdpr.requireConsent)}
                        disabled={gdprSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                          gdpr.requireConsent ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                        }`}
                        aria-pressed={gdpr.requireConsent}
                      >
                        <span className="sr-only">{gdpr.requireConsent ? "Enabled" : "Disabled"}</span>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${gdpr.requireConsent ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    {/* Allow Data Export toggle */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Allow Data Export</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enables the right of access under GDPR Art. 15. Users can download a machine-readable copy of all personal data stored in the system, including help requests, messages, audit logs, and account information.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGdpr("allowDataExport", gdpr.allowDataExport)}
                        disabled={gdprSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                          gdpr.allowDataExport ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                        }`}
                        aria-pressed={gdpr.allowDataExport}
                      >
                        <span className="sr-only">{gdpr.allowDataExport ? "Enabled" : "Disabled"}</span>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${gdpr.allowDataExport ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    {/* Allow Data Deletion toggle */}
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Allow Data Deletion</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Enables the right to erasure under GDPR Art. 17 (the &quot;right to be forgotten&quot;). Users can request permanent deletion of their account and all associated data. This action is irreversible and cascades through all related records.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleGdpr("allowDataDeletion", gdpr.allowDataDeletion)}
                        disabled={gdprSaving}
                        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                          gdpr.allowDataDeletion ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                        }`}
                        aria-pressed={gdpr.allowDataDeletion}
                      >
                        <span className="sr-only">{gdpr.allowDataDeletion ? "Enabled" : "Disabled"}</span>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${gdpr.allowDataDeletion ? "translate-x-5" : "translate-x-0.5"}`} />
                      </button>
                    </div>

                    {/* Retention Days */}
                    <div className="border-t border-border pt-4">
                      <label className="mb-1 block text-sm font-medium text-foreground">Data Retention Period</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        Under GDPR Art. 5(1)(e), personal data must not be kept longer than necessary. Records older than this period are automatically and permanently deleted, including help requests, messages, and associated audit logs.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          max="3650"
                          value={gdprRetentionInput}
                          onChange={(e) => setGdprRetentionInput(e.target.value)}
                          className="w-24 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                        <button
                          onClick={() => saveGdpr({ retentionDays: parseInt(gdprRetentionInput, 10) || 90 })}
                          disabled={gdprSaving}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {gdprSaved ? "Saved!" : "Update"}
                        </button>
                      </div>
                    </div>

                    {/* Privacy Policy URL */}
                    <div className="border-t border-border pt-4">
                      <label className="mb-1 block text-sm font-medium text-foreground">Privacy Policy URL</label>
                      <p className="text-xs text-muted-foreground mb-2">
                        GDPR Art. 13 and 14 require you to inform data subjects about how their data is processed. This URL is shown to users so they can review your full privacy policy.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="url"
                          value={gdprPolicyUrl}
                          onChange={(e) => setGdprPolicyUrl(e.target.value)}
                          placeholder="https://example.com/privacy"
                          className="flex-1 max-w-md rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        />
                        <button
                          onClick={() => saveGdpr({ privacyPolicyUrl: gdprPolicyUrl })}
                          disabled={gdprSaving}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {gdprSaved ? "Saved!" : "Update"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* User Consent Preferences */}
                {consent && (
                  <div className="rounded-lg border border-border bg-card p-6">
                    <h3 className="font-serif text-base font-semibold text-foreground mb-1">Your Consent Preferences</h3>
                    <p className="text-sm text-muted-foreground mb-5">
                      Under GDPR Art. 7, you have the right to withdraw consent at any time. Toggling a consent off does not affect the lawfulness of processing performed before withdrawal.
                    </p>
                    <div className="space-y-5">
                      {consent.consents.map((c) => {
                        const descriptions: Record<string, { title: string; description: string; legal: string }> = {
                          data_processing: {
                            title: "Data Processing",
                            description: "Allows HeySummon to store and process your help requests, messages, expert responses, and associated metadata (timestamps, reference codes, approval decisions). This is the core functionality that enables the question-and-answer workflow between clients and experts.",
                            legal: "Legal basis: Art. 6(1)(a) GDPR — consent, or Art. 6(1)(b) — necessary for the performance of the service you have requested.",
                          },
                          communications: {
                            title: "Communications",
                            description: "Allows HeySummon to send you notifications about help requests via your configured channels (email, Telegram, phone calls). This includes new request alerts, response notifications, and status updates. Without this consent, you will not receive real-time notifications about incoming requests.",
                            legal: "Legal basis: Art. 6(1)(a) GDPR — consent. You can opt out at any time without affecting the core service.",
                          },
                          analytics: {
                            title: "Analytics",
                            description: "Allows HeySummon to collect anonymous usage metrics such as response times, request volumes, and feature usage patterns. This data is used to improve the service, identify performance bottlenecks, and plan capacity. No personally identifiable information is included in analytics when IP anonymization is enabled.",
                            legal: "Legal basis: Art. 6(1)(f) GDPR — legitimate interest in improving the service, balanced against your right to privacy through anonymization.",
                          },
                        };
                        const info = descriptions[c.type] || {
                          title: c.type.replace(/_/g, " "),
                          description: "Controls data processing for this category.",
                          legal: "Legal basis: Art. 6(1)(a) GDPR — consent.",
                        };
                        return (
                          <div key={c.type} className="rounded-md border border-border p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">{info.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{info.description}</p>
                                <p className="text-xs text-muted-foreground/70 mt-1 italic">{info.legal}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  {c.granted
                                    ? `Granted${c.grantedAt ? ` on ${new Date(c.grantedAt).toLocaleDateString()}` : ""}`
                                    : c.revokedAt
                                      ? `Revoked on ${new Date(c.revokedAt).toLocaleDateString()}`
                                      : "Not yet granted"}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => updateConsent(c.type, !c.granted)}
                                disabled={consentSaving === c.type}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50 ${
                                  c.granted ? "bg-orange-600" : "bg-zinc-600 dark:bg-zinc-500"
                                }`}
                                aria-pressed={c.granted}
                              >
                                <span className="sr-only">{c.granted ? "Granted" : "Revoked"}</span>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${c.granted ? "translate-x-5" : "translate-x-0.5"}`} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Data Rights */}
                <div className="rounded-lg border border-border bg-card p-6">
                  <h3 className="font-serif text-base font-semibold text-foreground mb-1">Your Data Rights</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    Under GDPR, you have the right to access (Art. 15) and erase (Art. 17) your personal data. You can also export data for any client or expert in the system.
                  </p>

                  {/* Export own data */}
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-foreground mb-1">Export my data</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Downloads a JSON file containing all your personal data: account info, expert profiles, API keys, help requests, messages, and audit logs.
                      </p>
                      <button
                        onClick={exportMyData}
                        disabled={exportLoading}
                        className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {exportLoading ? "Exporting..." : exportDone ? "Downloaded!" : "Export My Data"}
                      </button>
                    </div>

                    {/* Export client/expert data */}
                    <div className="border-t border-border pt-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium text-foreground">Export client or expert data</p>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3">
                        Select a client or expert to export all their associated data. For clients, this includes all help requests submitted through that API key, messages, and interaction history. For experts, this includes their profile, linked clients, handled requests, and response history.
                      </p>
                      <div className="flex items-center gap-2">
                        <select
                          value={entityExportTarget}
                          onChange={(e) => setEntityExportTarget(e.target.value)}
                          className="flex-1 max-w-sm rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                        >
                          <option value="">Select client or expert...</option>
                          {exportEntities.filter((e) => e.type === "expert").length > 0 && (
                            <optgroup label="Experts">
                              {exportEntities.filter((e) => e.type === "expert").map((e) => (
                                <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>{e.label}</option>
                              ))}
                            </optgroup>
                          )}
                          {exportEntities.filter((e) => e.type === "client").length > 0 && (
                            <optgroup label="Clients">
                              {exportEntities.filter((e) => e.type === "client").map((e) => (
                                <option key={`${e.type}:${e.id}`} value={`${e.type}:${e.id}`}>{e.label}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                        <button
                          onClick={exportEntityData}
                          disabled={entityExportLoading || !entityExportTarget}
                          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5" />
                          {entityExportLoading ? "Exporting..." : entityExportDone ? "Downloaded!" : "Export"}
                        </button>
                      </div>
                    </div>

                    {/* Delete account */}
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-foreground mb-1">Delete my account</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        Permanently deletes your account and all associated data. This action is irreversible and will remove all expert profiles, API keys, help requests, messages, and audit logs.
                      </p>
                      <button
                        onClick={() => {
                          if (window.confirm("Are you sure you want to delete all your data? This action is irreversible.")) {
                            fetch("/api/gdpr/data-request", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ type: "deletion", confirm: true }),
                            }).then(() => {
                              window.location.href = "/";
                            });
                          }
                        }}
                        className="flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete My Account
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
