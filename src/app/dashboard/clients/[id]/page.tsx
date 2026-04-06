"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { copyToClipboard } from "@/lib/clipboard";
import {
  ArrowLeft, Copy, Check, RefreshCw, Loader2, Trash2,
  Power, PowerOff, ExternalLink, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

const SCOPE_OPTIONS = ["full", "read", "write", "admin"] as const;

const scopeBadgeColors: Record<string, string> = {
  full: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  read: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
  write: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  admin: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300",
};

const channelLabel = (channel: string | null, sub: string | null) => {
  if (!channel) return null;
  if (channel === "claudecode") return { label: "Claude Code", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300" };
  if (channel === "openclaw" && sub === "whatsapp") return { label: "OpenClaw · WhatsApp", color: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300" };
  if (channel === "openclaw") return { label: "OpenClaw · Telegram", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" };
  return null;
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [client, setClient] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Name editing
  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Settings editing
  const [scope, setScope] = useState("full");
  const [rateLimit, setRateLimit] = useState(150);
  const [channel, setChannel] = useState<string | null>(null);
  const [subChannel, setSubChannel] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Misc UI
  const [copied, setCopied] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotationResult, setRotationResult] = useState<{ key: string; deviceSecret: string; expiresAt: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [setupLink, setSetupLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/keys/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    const k: ApiKey = data.key;
    setClient(k);
    setName(k.name ?? "");
    setScope(k.scope);
    setRateLimit(k.rateLimitPerMinute);
    setChannel(k.clientChannel);
    setSubChannel(k.clientSubChannel);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const copyVal = (val: string) => {
    copyToClipboard(val);
    setCopied(val);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) => key.slice(0, 8) + "\u2022".repeat(16) + key.slice(-4);

  const saveName = async () => {
    if (!client) return;
    setSavingName(true);
    await fetch(`/api/v1/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() || null }),
    });
    setSavingName(false);
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2000);
    fetchClient();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await fetch(`/api/v1/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, rateLimitPerMinute: rateLimit, clientChannel: channel, clientSubChannel: subChannel }),
    });
    setSavingSettings(false);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
    fetchClient();
  };

  const toggleActive = async () => {
    if (!client) return;
    setToggling(true);
    await fetch(`/api/v1/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !client.isActive }),
    });
    setToggling(false);
    fetchClient();
  };

  const rotateKey = async () => {
    if (!window.confirm("Rotate this key?\n\nA new key and device secret will be generated. The old key will remain valid for 24 hours.")) return;
    setRotating(true);
    const res = await fetch(`/api/v1/keys/${id}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) {
      setRotationResult({ key: data.key, deviceSecret: data.deviceSecret, expiresAt: data.previousKeyExpiresAt });
      fetchClient();
    }
    setRotating(false);
  };

  const deleteKey = async () => {
    const res = await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard/clients");
  };

  const generateSetupLink = async () => {
    setGeneratingLink(true);
    const res = await fetch("/api/v1/setup-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keyId: id, channel: client?.clientChannel || "openclaw", subChannel: client?.clientSubChannel }),
    });
    const data = await res.json();
    if (res.ok) setSetupLink({ url: data.setupUrl, expiresAt: data.expiresAt });
    setGeneratingLink(false);
  };

  const updateIpEvent = async (eventId: string, status: string) => {
    await fetch(`/api/v1/keys/${id}/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchClient();
  };

  const removeIpEvent = async (eventId: string) => {
    await fetch(`/api/v1/keys/${id}/ip-events/${eventId}`, { method: "DELETE" });
    fetchClient();
  };

  const resetAllIpBindings = async () => {
    if (!window.confirm("Reset all IP bindings?")) return;
    await fetch(`/api/v1/keys/${id}/ip-events/reset`, { method: "POST" });
    fetchClient();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !client) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Client not found.</p>
        <div className="mt-4 flex items-center gap-4">
          <Link href="/dashboard/clients" className="text-sm text-orange-600 hover:underline inline-block">
            <ArrowLeft className="inline h-3.5 w-3.5 mr-1" />
            Back to clients
          </Link>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={async () => {
              if (!window.confirm("Delete this client? This cannot be undone.")) return;
              const res = await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
              if (res.ok) router.push("/dashboard/clients");
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            Delete
          </Button>
        </div>
      </div>
    );
  }

  const ch = channelLabel(client.clientChannel, client.clientSubChannel);
  const isInGracePeriod = client.previousKeyExpiresAt && new Date(client.previousKeyExpiresAt) > new Date();

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <Link href="/dashboard/clients" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-3.5 w-3.5" />
            Clients
          </Link>
          <h1 className="text-2xl font-semibold text-foreground">{client.name || "Unnamed"}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            {ch && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ch.color}`}>
                {ch.label}
              </span>
            )}
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
              !client.isActive
                ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                : client.ipEvents?.some((e) => e.status === "allowed")
                  ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                  : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
            }`}>
              {!client.isActive ? "Inactive" : client.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
            </span>
            {isInGracePeriod && (
              <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/40 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">Grace period</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 pt-8">
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={toggling}>
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : client.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{client.isActive ? "Deactivate" : "Activate"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={rotateKey} disabled={rotating || !client.isActive}>
            {rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Rotate key</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Key rotation result */}
      {rotationResult && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Key rotated — save these credentials now</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Old key valid until <strong>{new Date(rotationResult.expiresAt).toLocaleString()}</strong>.
          </p>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-muted-foreground">New API Key</Label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 mt-1">
                <code className="flex-1 truncate font-mono text-xs">{rotationResult.key}</code>
                <Button variant="ghost" size="sm" onClick={() => copyVal(rotationResult.key)} className="h-auto px-2 py-0.5 text-xs">
                  {copied === rotationResult.key ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">New Device Secret</Label>
              <div className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 mt-1">
                <code className="flex-1 truncate font-mono text-xs">{rotationResult.deviceSecret}</code>
                <Button variant="ghost" size="sm" onClick={() => copyVal(rotationResult.deviceSecret)} className="h-auto px-2 py-0.5 text-xs">
                  {copied === rotationResult.deviceSecret ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setRotationResult(null)}>Dismiss</Button>
        </div>
      )}

      {/* ─── Client name ─────────────────────────────────────────── */}
      <div className="py-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Client name</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1 max-w-sm space-y-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveName()}
              placeholder="e.g. John's Assistant"
            />
          </div>
          <Button onClick={saveName} disabled={savingName} size="sm">
            {savingName && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {nameSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
          </Button>
        </div>
      </div>

      {/* ─── API key & expert info ──────────────────────────────── */}
      <div className="py-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">API key</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Expert</Label>
            <p className="text-sm mt-0.5">
              {client.expert ? (
                <span className={!client.expert.isActive || client.expert.expertChannels.length === 0 ? "text-orange-600" : "text-foreground"}>
                  {client.expert.name}
                  {!client.expert.isActive && " (inactive)"}
                  {client.expert.isActive && client.expert.expertChannels.length === 0 && " — no channel configured"}
                </span>
              ) : (
                <span className="text-orange-600 inline-flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  No expert linked
                </span>
              )}
            </p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Key</Label>
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 mt-1 max-w-lg">
              <code className="flex-1 truncate font-mono text-xs text-foreground">{masked(client.key)}</code>
              <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={() => copyVal(client.key)}>
                {copied === client.key ? <><Check className="mr-1 h-3 w-3" />Copied</> : <><Copy className="mr-1 h-3 w-3" />Copy</>}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <span>
              <span className="text-muted-foreground">Requests: </span>
              <Link
                href={`/dashboard/requests?client=${encodeURIComponent(client.name || client.id)}`}
                className="text-foreground hover:text-orange-600 hover:underline"
              >
                {client._count.requests}
              </Link>
            </span>
            <span>
              <span className="text-muted-foreground">Created: </span>
              {new Date(client.createdAt).toLocaleDateString()}
            </span>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scopeBadgeColors[client.scope] ?? "bg-muted text-muted-foreground"}`}>
              {client.scope}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Settings ────────────────────────────────────────────── */}
      <div className="py-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Settings</h2>
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div className="space-y-1.5">
            <Label>Channel</Label>
            <select
              value={channel ?? ""}
              onChange={(e) => { setChannel(e.target.value || null); setSubChannel(null); }}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
            >
              <option value="">— not set —</option>
              <option value="openclaw">OpenClaw</option>
              <option value="claudecode">Claude Code</option>
            </select>
          </div>
          {channel === "openclaw" && (
            <div className="space-y-1.5">
              <Label>Platform</Label>
              <select
                value={subChannel ?? ""}
                onChange={(e) => setSubChannel(e.target.value || null)}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
              >
                <option value="">— select —</option>
                <option value="telegram">Telegram</option>
                <option value="whatsapp">WhatsApp</option>
              </select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Scope</Label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-ring"
            >
              {SCOPE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Rate limit (req/min)</Label>
            <Input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value) || 150)}
              min={1}
              max={10000}
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveSettings} disabled={savingSettings} size="sm">
            {savingSettings && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {settingsSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save settings"}
          </Button>
        </div>
      </div>

      {/* ─── Setup link ──────────────────────────────────────────── */}
      <div className="py-6 border-t border-border">
        <h2 className="text-sm font-medium text-muted-foreground mb-4">Setup link</h2>
        <p className="text-sm text-muted-foreground mb-3">
          Generate a setup link with credentials and setup instructions to send to your client. Valid for up to 24 hours, and automatically disabled when a device binds.
        </p>
        {setupLink ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2 max-w-lg">
              <span className="flex-1 truncate font-mono text-xs text-foreground">{setupLink.url}</span>
              <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={() => copyVal(setupLink.url)}>
                {copied === setupLink.url ? <><Check className="mr-1 h-3 w-3" />Copied</> : <><Copy className="mr-1 h-3 w-3" />Copy</>}
              </Button>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Expires at {new Date(setupLink.expiresAt).toLocaleTimeString()}</span>
              <a href={setupLink.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                Preview <ExternalLink className="h-3 w-3" />
              </a>
              <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={generateSetupLink} disabled={generatingLink}>
                Regenerate
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={generateSetupLink} disabled={generatingLink}>
            {generatingLink && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Generate setup link
          </Button>
        )}
      </div>

      {/* ─── IP Bindings ─────────────────────────────────────────── */}
      <div className="py-6 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">IP bindings</h2>
          {client.ipEvents.length > 0 && (
            <Button variant="outline" size="sm" onClick={resetAllIpBindings}>
              Reset all bindings
            </Button>
          )}
        </div>
        {client.ipEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No IP bindings yet.</p>
        ) : (
          <div className="space-y-2">
            {client.ipEvents.map((evt) => (
              <div key={evt.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs text-foreground">{evt.ip}</code>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    evt.status === "allowed" ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
                    : evt.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                    : "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
                  }`}>{evt.status}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {evt.attempts} attempts · last seen {new Date(evt.lastSeen).toLocaleString()}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {evt.status !== "allowed" && (
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={() => updateIpEvent(evt.id, "allowed")}>
                      Allow
                    </Button>
                  )}
                  {evt.status !== "blacklisted" && (
                    <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={() => updateIpEvent(evt.id, "blacklisted")}>
                      Blacklist
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-auto px-2 py-0.5 text-xs" onClick={() => removeIpEvent(evt.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete client?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{client.name || "this client"}</strong> and all linked help requests and messages. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteKey} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
