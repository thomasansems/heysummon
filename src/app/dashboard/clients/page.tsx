"use client";

import { copyToClipboard } from "@/lib/clipboard";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ClientDetailPanel } from "@/components/dashboard/client-detail-panel";

interface ProviderChannel {
  id: string;
  type: string;
  status: string;
}

interface Provider {
  id: string;
  name: string;
  isActive: boolean;
  channelProviders: ProviderChannel[];
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
  provider: Provider | null;
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

function providerStatus(provider: Provider | null): { label: string; warning: string | null } {
  if (!provider) return { label: "—", warning: "No provider linked — requests cannot be delivered." };
  if (!provider.isActive) return { label: provider.name, warning: "Provider is inactive." };
  if (provider.channelProviders.length === 0) return { label: provider.name, warning: "Provider has no channel configured — requests will be blocked." };
  return { label: provider.name, warning: null };
}

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
    description: "Skill — inline in editor",
    disabled: false,
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

type WizardStep = 0 | 1 | 2 | 3; // 0=closed, 1=channel, 2=details, 3=done

const SCOPE_OPTIONS = ["full", "read", "write", "admin"] as const;

const scopeBadgeColors: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  read: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  write: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  admin: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

export default function ClientsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
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
                  ? "Configure your Claude Code skill client"
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
                  This setup link is valid for 24 hours and is automatically disabled when a device binds.
                  Credentials are embedded — share it with your client.
                </span>
              </div>

              <p className="mb-3 text-sm text-muted-foreground">
                Share this link with your client. It opens step-by-step setup instructions with their credentials pre-filled.
              </p>

              <div className="mb-3 rounded-md border border-border bg-black p-3">
                <p className="mb-1 text-xs text-muted-foreground">
                  Setup link ({wizardChannel === "openclaw" ? `OpenClaw · ${wizardSubChannel}` : "Claude Code · Skill"})
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
                  <th className="px-4 py-2.5 font-medium">Provider</th>
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
                    {(() => { const ps = providerStatus(k.provider); return <span className={ps.warning ? "text-orange-600" : ""}>{ps.label}</span>; })()}
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
                  <th className="px-4 py-2.5 font-medium">Provider</th>
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
                        const ps = providerStatus(k.provider);
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "OpenClaw", icon: "/icons/openclaw.svg", active: true },
            { label: "Claude Code", icon: "/icons/claudecode.svg", active: true },
            { label: "OpenAI", icon: "/icons/openai.svg", active: false },
            { label: "NanoClaw", icon: "/icons/docker.svg", active: false },
            { label: "NemoClaw", icon: "/icons/nvidia.svg", active: false },
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
