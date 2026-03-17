"use client";

import { copyToClipboard } from "@/lib/clipboard";

import { Fragment, useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
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
  provider: { id: string; name: string } | null;
  ipEvents: IpEvent[];
  _count: { requests: number };
}

const channelLabel = (channel: string | null, sub: string | null) => {
  if (!channel) return null;
  if (channel === "claudecode") return { label: "Claude Code", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300" };
  if (channel === "openclaw" && sub === "whatsapp") return { label: "OpenClaw · WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" };
  if (channel === "openclaw") return { label: "OpenClaw · Telegram", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" };
  return null;
};

type WizardChannel = "openclaw" | "claudecode" | null;
type WizardSubChannel = "telegram" | "whatsapp" | null;

const CLIENT_CHANNELS = [
  {
    id: "openclaw" as const,
    label: "OpenClaw",
    icon: "/icons/openclaw.svg",
    description: "AI agent via Telegram or WhatsApp",
    disabled: false,
  },
  {
    id: "claudecode" as const,
    label: "Claude Code",
    icon: "/icons/claudecode.svg",
    description: "MCP server — inline in editor",
    disabled: false,
  },
  {
    id: null,
    label: "Signal",
    icon: "/icons/signal.svg",
    description: "Coming soon",
    disabled: true,
  },
  {
    id: null,
    label: "Slack",
    icon: "/icons/slack.svg",
    description: "Coming soon",
    disabled: true,
  },
];

const OPENCLAW_PLATFORMS = [
  { id: "telegram" as const, label: "Telegram", icon: "/icons/telegram.svg" },
  { id: "whatsapp" as const, label: "WhatsApp", icon: "/icons/whatsapp.svg" },
];

type WizardStep = 0 | 1 | 2 | 3; // 0=closed, 1=channel, 2=details, 3=done

const SCOPE_OPTIONS = ["full", "read", "write", "admin"] as const;

const scopeBadgeColors: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  read: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  write: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  admin: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

export default function ClientsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState("full");
  const [editRateLimit, setEditRateLimit] = useState(150);
  const [editChannel, setEditChannel] = useState<string | null>(null);
  const [editSubChannel, setEditSubChannel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);
  const [rotationResult, setRotationResult] = useState<{ key: string; deviceSecret: string; expiresAt: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [generatingSetupLink, setGeneratingSetupLink] = useState<string | null>(null);
  const [setupLinks, setSetupLinks] = useState<Record<string, { url: string; expiresAt: string }>>({});

  // Wizard state
  const [wizardStep, setWizardStep] = useState<WizardStep>(0);
  const [wizardChannel, setWizardChannel] = useState<WizardChannel>(null);
  const [wizardSubChannel, setWizardSubChannel] = useState<WizardSubChannel>(null);
  const [wizardName, setWizardName] = useState("");
  const [wizardProviderId, setWizardProviderId] = useState("");
  const [wizardCreating, setWizardCreating] = useState(false);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [wizardResult, setWizardResult] = useState<{ keyId: string; key: string; setupUrl: string; expiresAt: string } | null>(null);

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

  const loadProviders = () =>
    fetch("/api/providers")
      .then((r) => {
        if (!r.ok) return { providers: [] };
        return r.json();
      })
      .then((data) => {
        setProviders(data.providers || []);
      })
      .catch(() => setProviders([]));

  useEffect(() => {
    loadKeys();
    loadProviders();
  }, []);

  const openWizard = () => {
    setWizardStep(1);
    setWizardChannel(null);
    setWizardSubChannel(null);
    setWizardName("");
    setWizardProviderId("");
    setWizardError(null);
    setWizardResult(null);
  };

  const closeWizard = () => {
    setWizardStep(0);
    setWizardResult(null);
  };

  const wizardNext = () => {
    if (wizardStep === 1) {
      // Validate channel selected
      if (!wizardChannel) return;
      if (wizardChannel === "openclaw" && !wizardSubChannel) return;
      setWizardStep(2);
    } else if (wizardStep === 2) {
      createWizardKey();
    }
  };

  const DEFAULT_RATE_LIMIT = parseInt(process.env.NEXT_PUBLIC_DEFAULT_RATE_LIMIT ?? "150");

  const createWizardKey = async () => {
    if (!wizardProviderId) return;
    setWizardCreating(true);

    // Create the key (rate limit defaults to env var or 150)
    const keyRes = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: wizardName || undefined,
        providerId: wizardProviderId,
        scope: "full",
        rateLimitPerMinute: DEFAULT_RATE_LIMIT,
        clientChannel: wizardChannel,
        clientSubChannel: wizardSubChannel ?? undefined,
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
      }),
    });

    if (!linkRes.ok) {
      setWizardError("Key created, but failed to generate setup link. Use 'Share' from the client menu.");
      setWizardCreating(false);
      setWizardStep(3);
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
    setWizardStep(3);
    loadKeys();
  };

  const renameKey = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/v1/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName.trim() }) });
    setEditingId(null);
    setEditName("");
    loadKeys();
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/v1/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) });
    loadKeys();
  };

  const activate = async (id: string) => {
    await fetch(`/api/v1/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) });
    loadKeys();
  };

  const deleteKey = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?\n\n⚠️ This will also delete ALL help requests and messages linked to this key.\n\nThis cannot be undone.`)) return;
    await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
    loadKeys();
  };

  const rotateKey = async (id: string) => {
    if (!window.confirm("Rotate this key?\n\nA new key and device secret will be generated. The old key will remain valid for 24 hours to allow seamless migration.")) return;
    setRotating(id);
    const res = await fetch(`/api/v1/keys/${id}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRotationResult({
        key: data.key,
        deviceSecret: data.deviceSecret,
        expiresAt: data.previousKeyExpiresAt,
      });
      loadKeys();
    }
    setRotating(null);
  };

  const generateSetupLink = async (keyId: string) => {
    setGeneratingSetupLink(keyId);
    const k = keys.find(k => k.id === keyId);
    // Map clientChannel to API channel field
    const channel = k?.clientChannel === "claudecode" ? "claudecode" : "openclaw";
    const subChannel = k?.clientSubChannel as "telegram" | "whatsapp" | undefined ?? undefined;
    const res = await fetch("/api/v1/setup-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId, channel, subChannel }),
    });
    const data = await res.json();
    if (res.ok) {
      setSetupLinks(prev => ({ ...prev, [keyId]: { url: data.setupUrl, expiresAt: data.expiresAt } }));
    }
    setGeneratingSetupLink(null);
  };

  const saveSettings = async (id: string) => {
    setSaving(true);
    await fetch(`/api/v1/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: editScope,
        rateLimitPerMinute: editRateLimit,
        clientChannel: editChannel,
        clientSubChannel: editSubChannel,
      }),
    });
    setSaving(false);
    setSettingsId(null);
    loadKeys();
  };

  const openSettings = (k: ApiKey) => {
    if (settingsId === k.id) {
      setSettingsId(null);
      return;
    }
    setSettingsId(k.id);
    setEditScope(k.scope);
    setEditRateLimit(k.rateLimitPerMinute);
    setEditChannel(k.clientChannel);
    setEditSubChannel(k.clientSubChannel);
  };

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 8) + "•".repeat(16) + key.slice(-4);

  const configSnippet = (key: string) =>
    `# HeySummon API configuration\nheysummon:\n  api_key: "${key}"\n  endpoint: "${typeof window !== "undefined" ? window.location.origin : ""}/api/v1/help"`;

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
              <div className="mb-5 grid grid-cols-2 gap-3">
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
                      <img src={ch.icon} alt={ch.label} className="h-7 w-7 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
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
                {wizardChannel === "claudecode"
                  ? "Configure your Claude Code MCP client"
                  : `Configure your OpenClaw ${wizardSubChannel} client`}
              </p>

              <div className="mb-4 space-y-3">
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

                {/* Provider */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">Provider <span className="text-red-400">*</span></label>
                  {providers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No providers yet.{" "}
                      <a href="/dashboard/providers" className="text-orange-600 hover:text-orange-800">Create one first</a>.
                    </p>
                  ) : (
                    <select
                      value={wizardProviderId}
                      onChange={(e) => setWizardProviderId(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    >
                      <option value="">Select provider...</option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
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
                    disabled={wizardCreating || !wizardProviderId}
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                  >
                    {wizardCreating ? "Creating..." : "Create Client"}
                  </button>
                </div>
                {wizardError && (
                  <p className="mt-2 text-xs text-red-500">{wizardError}</p>
                )}
              </div>
            </div>
          )}

          {/* Step 3 — Done / Setup URL */}
          {wizardStep === 3 && wizardResult && (
            <div>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <h2 className="text-lg font-semibold text-foreground">Client created!</h2>
              </div>

              {/* Expiry warning */}
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <span>⏱</span>
                <span>
                  This setup link expires at{" "}
                  <strong>{new Date(wizardResult.expiresAt).toLocaleTimeString()}</strong> (10 minutes).
                  Share it now — credentials are embedded.
                </span>
              </div>

              <p className="mb-3 text-sm text-muted-foreground">
                Share this link with your client. It opens step-by-step setup instructions with their credentials pre-filled.
              </p>

              <div className="mb-3 rounded-md border border-border bg-black p-3">
                <p className="mb-1 text-xs text-muted-foreground">
                  Setup link ({wizardChannel === "openclaw" ? `OpenClaw · ${wizardSubChannel}` : "Claude Code · MCP"})
                </p>
                <code className="break-all text-xs text-green-400">{wizardResult.setupUrl}</code>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => copyKey(wizardResult.setupUrl)}
                  className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white"
                >
                  {copied === wizardResult.setupUrl ? "Copied!" : "📋 Copy link"}
                </button>
                <a
                  href={wizardResult.setupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Preview →
                </a>
              </div>

              <p className="mt-3 text-xs text-muted-foreground">
                💡 After the link expires, generate a new one via the{" "}
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
          {wizardStep < 3 && (
            <div className="mt-6 flex justify-center gap-2">
              {[1, 2].map((s) => (
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
      {/* Wizard modal */}
      {renderWizard()}

      {/* Key rotation result modal */}
      {rotationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/60">
                <span className="text-base">🔑</span>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-foreground">Key Rotated Successfully</h2>
                <p className="text-xs text-muted-foreground">Save these credentials — the secret won&apos;t be shown again</p>
              </div>
            </div>
            {/* Body */}
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                The old key remains valid until <strong>{new Date(rotationResult.expiresAt).toLocaleString()}</strong> to allow seamless migration.
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">New API Key</label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                  <code className="flex-1 truncate font-mono text-xs text-foreground">{rotationResult.key}</code>
                  <button onClick={() => copyKey(rotationResult.key)} className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-500">
                    {copied === rotationResult.key ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">New Device Secret</label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2">
                  <code className="flex-1 truncate font-mono text-xs text-foreground">{rotationResult.deviceSecret}</code>
                  <button onClick={() => copyKey(rotationResult.deviceSecret)} className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-500">
                    {copied === rotationResult.deviceSecret ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Send a new setup link to your client via Settings → Setup Link after closing this.
              </p>
            </div>
            {/* Footer */}
            <div className="flex justify-end border-t border-border px-5 py-3">
              <button
                onClick={() => setRotationResult(null)}
                className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Mobile loading skeleton */}
            <div className="md:hidden">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border-b border-border p-4 space-y-3 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="h-6 w-8 rounded bg-muted" />
                  </div>
                  <div className="h-4 w-20 rounded bg-muted" />
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-5 w-16 rounded-full bg-muted" />
                    <div className="h-4 w-8 rounded bg-muted" />
                    <div className="h-5 w-20 rounded-full bg-muted" />
                    <div className="h-4 w-20 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
            {/* Desktop loading skeleton */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">Scope</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="px-4 py-2.5"><div className="h-4 w-24 rounded bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-32 rounded bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-5 w-16 rounded-full bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-8 rounded bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-5 w-20 rounded-full bg-muted"></div></td>
                    <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-muted"></div></td>
                    <td className="px-4 py-2.5 text-right"><div className="ml-auto h-6 w-8 rounded bg-muted"></div></td>
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
            <div className="md:hidden">
              {keys.map((k) => (
                <Fragment key={k.id}>
                  <div className="border-b border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-muted-foreground">Name</span>
                        <div className="font-medium text-foreground">
                          {editingId === k.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter") renameKey(k.id); if (e.key === "Escape") setEditingId(null); }}
                                className="w-32 rounded border border-border px-2 py-0.5 text-sm outline-none focus:border-ring"
                                autoFocus
                              />
                              <button onClick={() => renameKey(k.id)} className="text-xs text-green-600">OK</button>
                              <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">X</button>
                            </div>
                          ) : (
                            <span
                              className="cursor-pointer hover:underline"
                              onClick={() => { setEditingId(k.id); setEditName(k.name || ""); }}
                              title="Click to rename"
                            >
                              {k.name || "Unnamed"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
                          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          ⋯
                        </button>
                        {openMenuId === k.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
                            <button onClick={() => { openSettings(k); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Settings</button>
                            <button onClick={() => { setShowInstructions(showInstructions === k.id ? null : k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Setup</button>
                            {k.isActive && (
                              <button onClick={() => { rotateKey(k.id); setOpenMenuId(null); }} disabled={rotating === k.id} className="block w-full px-3 py-1.5 text-left text-xs text-orange-600 hover:bg-muted hover:text-orange-800 disabled:opacity-50">
                                {rotating === k.id ? "Rotating..." : "Rotate"}
                              </button>
                            )}
                            {k.isActive ? (
                              <button onClick={() => { deactivate(k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-muted hover:text-red-400">Deactivate</button>
                            ) : (
                              <button onClick={() => { activate(k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-muted hover:text-green-800">Activate</button>
                            )}
                            <div className="my-1 border-t border-border" />
                            <button onClick={() => { deleteKey(k.id, k.name || "this client"); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300">Delete</button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Provider</span>
                      <div className="text-muted-foreground">{k.provider?.name || "-"}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Channel</span>
                      <div>{(() => { const ch = channelLabel(k.clientChannel, k.clientSubChannel); return ch ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}</div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Key</span>
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-muted-foreground break-all">{masked(k.key)}</code>
                        <button onClick={() => copyKey(k.key)} className="shrink-0 text-xs text-orange-600 hover:text-orange-800">{copied === k.key ? "Copied!" : "Copy"}</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Scope</span>
                        <div><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scopeBadgeColors[k.scope] || "bg-muted text-muted-foreground"}`}>{k.scope}</span></div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Requests</span>
                        <div className="text-muted-foreground">{k._count.requests}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Status</span>
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${!k.isActive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : k.ipEvents?.some((e) => e.status === "allowed") ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"}`}>
                            {!k.isActive ? "Inactive" : k.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
                          </span>
                          {isInGracePeriod(k) && (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-300">Grace</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Created</span>
                        <div className="text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                  </div>
                  {settingsId === k.id && (
                    <div className="border-b border-border bg-muted px-4 py-3">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Key Settings</p>
                      <div className="flex flex-wrap items-end gap-3">
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Channel</label>
                          <select value={editChannel ?? ""} onChange={(e) => { setEditChannel(e.target.value || null); setEditSubChannel(null); }} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                            <option value="">— not set —</option>
                            <option value="openclaw">OpenClaw</option>
                            <option value="claudecode">Claude Code</option>
                          </select>
                        </div>
                        {editChannel === "openclaw" && (
                          <div>
                            <label className="mb-1 block text-xs text-muted-foreground">Platform</label>
                            <select value={editSubChannel ?? ""} onChange={(e) => setEditSubChannel(e.target.value || null)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                              <option value="">— select —</option>
                              <option value="telegram">Telegram</option>
                              <option value="whatsapp">WhatsApp</option>
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Scope</label>
                          <select value={editScope} onChange={(e) => setEditScope(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                            {SCOPE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs text-muted-foreground">Rate Limit (req/min)</label>
                          <input type="number" value={editRateLimit} onChange={(e) => setEditRateLimit(parseInt(e.target.value) || 150)} min={1} max={10000} className="w-24 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring" />
                        </div>
                        <button onClick={() => saveSettings(k.id)} disabled={saving} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                        <button onClick={() => setSettingsId(null)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
                      </div>
                      <div className="mt-4 border-t border-border pt-3">
                        <div className="mb-2 flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">IP Bindings</p>
                          {k.ipEvents?.length > 0 && (
                            <button onClick={async () => { if (!window.confirm("Reset all IP bindings?")) return; await fetch(`/api/v1/keys/${k.id}/ip-events/reset`, { method: "POST" }); loadKeys(); }} className="rounded-md border border-red-800 px-2 py-0.5 text-xs text-red-600 hover:bg-red-950/40">Reset All Bindings</button>
                          )}
                        </div>
                        {!k.ipEvents || k.ipEvents.length === 0 ? (
                          <p className="text-xs text-muted-foreground">No IP bindings yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {k.ipEvents.map((evt) => (
                              <div key={evt.id} className="rounded border border-border p-2 text-xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-muted-foreground">{evt.ip}</span>
                                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${evt.status === "allowed" ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : evt.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"}`}>{evt.status}</span>
                                </div>
                                <div className="mt-1 text-muted-foreground">{evt.attempts} attempts · {new Date(evt.lastSeen).toLocaleString()}</div>
                                <div className="mt-1 flex items-center gap-1">
                                  {evt.status !== "allowed" && <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "allowed" }) }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50">Allow</button>}
                                  {evt.status !== "blacklisted" && <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "blacklisted" }) }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">Blacklist</button>}
                                  <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "DELETE" }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-[#f0f0f0]">Remove</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {showInstructions === k.id && (
                    <div className="border-b border-border bg-muted/50 px-4 py-4 space-y-3">
                      <p className="text-xs font-semibold text-foreground">Setup Link</p>
                      <p className="text-xs text-muted-foreground">Generate a 10-minute setup link to send to your client. It contains all credentials and step-by-step instructions.</p>
                      {setupLinks[k.id] ? (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                            <span className="flex-1 truncate font-mono text-xs text-foreground">{setupLinks[k.id].url}</span>
                            <button onClick={() => { copyKey(setupLinks[k.id].url); }} className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-500">{copied === setupLinks[k.id].url ? "Copied!" : "Copy"}</button>
                          </div>
                          <p className="text-xs text-muted-foreground">Expires at {new Date(setupLinks[k.id].expiresAt).toLocaleTimeString()}</p>
                          <button onClick={() => generateSetupLink(k.id)} disabled={generatingSetupLink === k.id} className="text-xs text-orange-600 hover:text-orange-500 disabled:opacity-50">↻ Regenerate link</button>
                        </div>
                      ) : (
                        <button onClick={() => generateSetupLink(k.id)} disabled={generatingSetupLink === k.id} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          {generatingSetupLink === k.id ? "Generating…" : "Generate Setup Link"}
                        </button>
                      )}
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
                  <th className="px-4 py-2.5 font-medium">Channel</th>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">Scope</th>
                  <th className="px-4 py-2.5 font-medium">Requests</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium" />
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <Fragment key={k.id}>
                    <tr className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 font-medium text-foreground">
                        {editingId === k.id ? (
                          <div className="flex items-center gap-1">
                            <input value={editName} onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renameKey(k.id); if (e.key === "Escape") setEditingId(null); }} className="w-32 rounded border border-border px-2 py-0.5 text-sm outline-none focus:border-ring" autoFocus />
                            <button onClick={() => renameKey(k.id)} className="text-xs text-green-600">OK</button>
                            <button onClick={() => setEditingId(null)} className="text-xs text-muted-foreground">X</button>
                          </div>
                        ) : (
                          <span className="cursor-pointer hover:underline" onClick={() => { setEditingId(k.id); setEditName(k.name || ""); }} title="Click to rename">{k.name || "Unnamed"}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {(() => { const ch = channelLabel(k.clientChannel, k.clientSubChannel); return ch ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span> : <span className="text-xs text-muted-foreground">—</span>; })()}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k.provider?.name || "-"}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs text-muted-foreground">{masked(k.key)}</code>
                          <button onClick={() => copyKey(k.key)} className="text-xs text-orange-600 hover:text-orange-800">{copied === k.key ? "Copied!" : "Copy"}</button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{k._count.requests}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${!k.isActive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" : k.ipEvents?.some((e) => e.status === "allowed") ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"}`}>
                            {!k.isActive ? "Inactive" : k.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
                          </span>
                          {isInGracePeriod(k) && (
                            <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-300" title={`Old key valid until ${new Date(k.previousKeyExpiresAt!).toLocaleString()}`}>Grace</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{new Date(k.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="relative inline-block">
                          <button onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)} className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">⋯</button>
                          {openMenuId === k.id && (
                            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
                              <button onClick={() => { openSettings(k); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Settings</button>
                              <button onClick={() => { setShowInstructions(showInstructions === k.id ? null : k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground">Setup</button>
                              {k.isActive && (
                                <button onClick={() => { rotateKey(k.id); setOpenMenuId(null); }} disabled={rotating === k.id} className="block w-full px-3 py-1.5 text-left text-xs text-orange-600 hover:bg-muted hover:text-orange-800 disabled:opacity-50">
                                  {rotating === k.id ? "Rotating..." : "Rotate"}
                                </button>
                              )}
                              {k.isActive ? (
                                <button onClick={() => { deactivate(k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-muted hover:text-red-400">Deactivate</button>
                              ) : (
                                <button onClick={() => { activate(k.id); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-muted hover:text-green-800">Activate</button>
                              )}
                              <div className="my-1 border-t border-border" />
                              <button onClick={() => { deleteKey(k.id, k.name || "this client"); setOpenMenuId(null); }} className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-300">Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                    {settingsId === k.id && (
                      <tr key={`${k.id}-settings`} className="border-b border-border">
                        <td colSpan={8} className="bg-muted px-4 py-3">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Key Settings</p>
                          <div className="flex flex-wrap items-end gap-3">
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Channel</label>
                              <select value={editChannel ?? ""} onChange={(e) => { setEditChannel(e.target.value || null); setEditSubChannel(null); }} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                                <option value="">— not set —</option>
                                <option value="openclaw">OpenClaw</option>
                                <option value="claudecode">Claude Code</option>
                              </select>
                            </div>
                            {editChannel === "openclaw" && (
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">Platform</label>
                                <select value={editSubChannel ?? ""} onChange={(e) => setEditSubChannel(e.target.value || null)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                                  <option value="">— select —</option>
                                  <option value="telegram">Telegram</option>
                                  <option value="whatsapp">WhatsApp</option>
                                </select>
                              </div>
                            )}
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Scope</label>
                              <select value={editScope} onChange={(e) => setEditScope(e.target.value)} className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring">
                                {SCOPE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}
                              </select>
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">Rate Limit (req/min)</label>
                              <input type="number" value={editRateLimit} onChange={(e) => setEditRateLimit(parseInt(e.target.value) || 150)} min={1} max={10000} className="w-24 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring" />
                            </div>
                            <button onClick={() => saveSettings(k.id)} disabled={saving} className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
                            <button onClick={() => setSettingsId(null)} className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground">Cancel</button>
                          </div>
                          <div className="mt-4 border-t border-border pt-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">IP Bindings</p>
                              {k.ipEvents?.length > 0 && (
                                <button onClick={async () => { if (!window.confirm("Reset all IP bindings?")) return; await fetch(`/api/v1/keys/${k.id}/ip-events/reset`, { method: "POST" }); loadKeys(); }} className="rounded-md border border-red-800 px-2 py-0.5 text-xs text-red-600 hover:bg-red-950/40">Reset All Bindings</button>
                              )}
                            </div>
                            {!k.ipEvents || k.ipEvents.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No IP bindings yet. The first API request will automatically bind its IP.</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-muted-foreground">
                                    <th className="pb-1 pr-4 font-medium">IP Address</th>
                                    <th className="pb-1 pr-4 font-medium">Status</th>
                                    <th className="pb-1 pr-4 font-medium">Attempts</th>
                                    <th className="pb-1 pr-4 font-medium">Last Seen</th>
                                    <th className="pb-1 font-medium" />
                                  </tr>
                                </thead>
                                <tbody>
                                  {k.ipEvents.map((evt) => (
                                    <tr key={evt.id} className="border-t border-border">
                                      <td className="py-1.5 pr-4 font-mono text-muted-foreground">{evt.ip}</td>
                                      <td className="py-1.5 pr-4">
                                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${evt.status === "allowed" ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" : evt.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"}`}>{evt.status}</span>
                                      </td>
                                      <td className="py-1.5 pr-4 text-muted-foreground">{evt.attempts}</td>
                                      <td className="py-1.5 pr-4 text-muted-foreground">{new Date(evt.lastSeen).toLocaleString()}</td>
                                      <td className="py-1.5 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                          {evt.status !== "allowed" && <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "allowed" }) }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50">Allow</button>}
                                          {evt.status !== "blacklisted" && <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "blacklisted" }) }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50">Blacklist</button>}
                                          <button onClick={async () => { await fetch(`/api/v1/keys/${k.id}/ip-events/${evt.id}`, { method: "DELETE" }); loadKeys(); }} className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-[#f0f0f0]">Remove</button>
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
                    {showInstructions === k.id && (
                      <tr key={`${k.id}-instructions`} className="border-b border-border">
                        <td colSpan={8} className="bg-muted/50 px-4 py-4">
                          <div className="max-w-lg space-y-2">
                            <p className="text-xs font-semibold text-foreground">Setup Link</p>
                            <p className="text-xs text-muted-foreground">Generate a 10-minute link with embedded credentials and step-by-step instructions for your client.</p>
                            {setupLinks[k.id] ? (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
                                  <span className="flex-1 truncate font-mono text-xs text-foreground">{setupLinks[k.id].url}</span>
                                  <button onClick={() => copyKey(setupLinks[k.id].url)} className="shrink-0 text-xs font-medium text-orange-600 hover:text-orange-500">{copied === setupLinks[k.id].url ? "Copied!" : "Copy"}</button>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-muted-foreground">Expires {new Date(setupLinks[k.id].expiresAt).toLocaleTimeString()}</span>
                                  <button onClick={() => generateSetupLink(k.id)} disabled={generatingSetupLink === k.id} className="text-xs text-orange-600 hover:text-orange-500 disabled:opacity-50">↻ Regenerate</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => generateSetupLink(k.id)} disabled={generatingSetupLink === k.id} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                                {generatingSetupLink === k.id ? "Generating…" : "Generate Setup Link"}
                              </button>
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
