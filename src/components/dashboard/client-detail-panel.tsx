"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { copyToClipboard } from "@/lib/clipboard";
import {
  Copy, Check, RefreshCw, Loader2, Trash2,
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

interface ProviderChannel { id: string; type: string; status: string }
interface Provider { id: string; name: string; isActive: boolean; channelProviders: ProviderChannel[] }
interface IpEvent { id: string; ip: string; status: string; attempts: number; firstSeen: string; lastSeen: string }
interface ApiKey {
  id: string; key: string; name: string | null; isActive: boolean; scope: string;
  rateLimitPerMinute: number; clientChannel: string | null; clientSubChannel: string | null;
  previousKeyExpiresAt: string | null; createdAt: string; machineId: string | null;
  provider: Provider | null; ipEvents: IpEvent[]; _count: { requests: number };
}

const scopeBadge: Record<string, string> = {
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
  if (channel === "codex") return { label: "Codex CLI", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" };
  if (channel === "gemini") return { label: "Gemini CLI", color: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" };
  if (channel === "cursor") return { label: "Cursor", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300" };
  return null;
};

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="font-serif text-base font-semibold text-foreground mb-4">{children}</h3>;
}

const statusBadge = (status: string) => {
  if (status === "allowed") return "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300";
  if (status === "pending") return "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300";
  return "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300";
};

export function ClientDetailPanel({
  clientId, onClose, onDeleted, onUpdated,
}: {
  clientId: string; onClose: () => void; onDeleted: () => void; onUpdated: () => void;
}) {
  const [client, setClient] = useState<ApiKey | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [rateLimit, setRateLimit] = useState(150);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [copied, setCopied] = useState<string | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotationResult, setRotationResult] = useState<{ key: string; deviceSecret: string; expiresAt: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [setupLink, setSetupLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [toggling, setToggling] = useState(false);

  const fetchClient = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/keys/${clientId}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json();
    const k: ApiKey = data.key;
    setClient(k);
    setName(k.name ?? "");
    setRateLimit(k.rateLimitPerMinute);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchClient(); }, [fetchClient]);

  const copyVal = (val: string) => { copyToClipboard(val); setCopied(val); setTimeout(() => setCopied(null), 2000); };
  const masked = (key: string) => key.slice(0, 8) + "\u2022".repeat(16) + key.slice(-4);

  const saveName = async () => {
    setSavingName(true);
    await fetch(`/api/v1/keys/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() || null }) });
    setSavingName(false); setNameSaved(true); setTimeout(() => setNameSaved(false), 2000);
    fetchClient(); onUpdated();
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    await fetch(`/api/v1/keys/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rateLimitPerMinute: rateLimit }) });
    setSavingSettings(false); setSettingsSaved(true); setTimeout(() => setSettingsSaved(false), 2000);
    fetchClient(); onUpdated();
  };

  const toggleActive = async () => {
    setToggling(true);
    await fetch(`/api/v1/keys/${clientId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !client?.isActive }) });
    setToggling(false); fetchClient(); onUpdated();
  };

  const rotateKey = async () => {
    if (!window.confirm("Rotate this key?\n\nA new key and device secret will be generated. The old key will remain valid for 24 hours.")) return;
    setRotating(true);
    const res = await fetch(`/api/v1/keys/${clientId}/rotate`, { method: "POST" });
    const data = await res.json();
    if (res.ok) { setRotationResult({ key: data.key, deviceSecret: data.deviceSecret, expiresAt: data.previousKeyExpiresAt }); fetchClient(); onUpdated(); }
    setRotating(false);
  };

  const deleteClient = async () => {
    const res = await fetch(`/api/v1/keys/${clientId}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  const generateSetupLink = async () => {
    setGeneratingLink(true);
    const res = await fetch("/api/v1/setup-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keyId: clientId, channel: client?.clientChannel || "openclaw", subChannel: client?.clientSubChannel }) });
    const data = await res.json();
    if (res.ok) setSetupLink({ url: data.setupUrl, expiresAt: data.expiresAt });
    setGeneratingLink(false);
  };

  const updateIpEvent = async (eventId: string, status: string) => {
    await fetch(`/api/v1/keys/${clientId}/ip-events/${eventId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    fetchClient();
  };

  const removeIpEvent = async (eventId: string) => {
    await fetch(`/api/v1/keys/${clientId}/ip-events/${eventId}`, { method: "DELETE" });
    fetchClient();
  };

  const resetAllIpBindings = async () => {
    if (!window.confirm("Reset all IP bindings?")) return;
    await fetch(`/api/v1/keys/${clientId}/ip-events/reset`, { method: "POST" });
    fetchClient();
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!client) return <p className="p-8 text-sm text-muted-foreground">Client not found.</p>;

  const ch = channelLabel(client.clientChannel, client.clientSubChannel);
  const isInGracePeriod = client.previousKeyExpiresAt && new Date(client.previousKeyExpiresAt) > new Date();
  const isBound = client.ipEvents?.some((e) => e.status === "allowed");

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto px-6 pb-8">

        {/* Status badges */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {ch && <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ch.color}`}>{ch.label}</span>}
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
            !client.isActive ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300"
            : isBound ? "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300"
            : "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300"
          }`}>
            {!client.isActive ? "Inactive" : isBound ? "Bound" : "No binding yet"}
          </span>
          {isInGracePeriod && <span className="inline-flex rounded-full bg-amber-100 dark:bg-amber-950/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">Grace</span>}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={toggleActive} disabled={toggling}>
            {toggling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : client.isActive ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            <span className="ml-1.5">{client.isActive ? "Deactivate" : "Activate"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={rotateKey} disabled={rotating || !client.isActive}>
            {rotating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Rotate</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Rotation result */}
        {rotationResult && (
          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Key rotated — save now</p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Old key valid until <strong>{new Date(rotationResult.expiresAt).toLocaleString()}</strong></p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">New API Key</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 mt-1">
                  <code className="flex-1 truncate font-mono text-xs">{rotationResult.key}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyVal(rotationResult.key)}>{copied === rotationResult.key ? "Copied" : "Copy"}</Button>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">New Device Secret</Label>
                <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 mt-1">
                  <code className="flex-1 truncate font-mono text-xs">{rotationResult.deviceSecret}</code>
                  <Button variant="ghost" size="sm" onClick={() => copyVal(rotationResult.deviceSecret)}>{copied === rotationResult.deviceSecret ? "Copied" : "Copy"}</Button>
                </div>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => setRotationResult(null)}>Dismiss</Button>
          </div>
        )}

        {/* ── Client name ──────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <SectionHeading>Client name</SectionHeading>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveName()} placeholder="e.g. John's Assistant" />
            </div>
            <Button onClick={saveName} disabled={savingName} size="sm">
              {savingName && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {nameSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
            </Button>
          </div>
        </div>

        {/* ── Provider ─────────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <SectionHeading>Provider</SectionHeading>
          {client.provider ? (
            <p className={`text-sm ${!client.provider.isActive || client.provider.channelProviders.length === 0 ? "text-orange-600" : "text-foreground"}`}>
              {client.provider.name}
              {!client.provider.isActive && " (inactive)"}
              {client.provider.isActive && client.provider.channelProviders.length === 0 && " — no channel configured"}
            </p>
          ) : (
            <p className="text-sm text-orange-600 inline-flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              No provider linked
            </p>
          )}
        </div>

        {/* ── API key ──────────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <SectionHeading>API key</SectionHeading>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
            <code className="flex-1 truncate font-mono text-xs text-foreground">{masked(client.key)}</code>
            <Button variant="ghost" size="sm" onClick={() => copyVal(client.key)}>
              {copied === client.key ? <><Check className="mr-1.5 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1.5 h-3.5 w-3.5" />Copy</>}
            </Button>
          </div>
          <div className="flex items-center gap-5 mt-3 text-sm text-muted-foreground">
            <span>
              Requests:{" "}
              <Link href={`/dashboard/requests?client=${encodeURIComponent(client.name || client.id)}`} className="text-foreground hover:text-orange-600 hover:underline">
                {client._count.requests}
              </Link>
            </span>
            <span>Created: {new Date(client.createdAt).toLocaleDateString()}</span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${scopeBadge[client.scope] ?? "bg-muted text-muted-foreground"}`}>{client.scope}</span>
          </div>
        </div>

        {/* ── Rate limit ───────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <SectionHeading>Rate limit</SectionHeading>
          <div className="flex items-end gap-3">
            <div className="w-36">
              <Label className="text-xs text-muted-foreground mb-1.5 block">Requests per minute</Label>
              <Input type="number" value={rateLimit} onChange={(e) => setRateLimit(parseInt(e.target.value) || 150)} min={1} max={10000} />
            </div>
            <Button onClick={saveSettings} disabled={savingSettings} size="sm">
              {savingSettings && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {settingsSaved ? <><Check className="mr-1.5 h-3.5 w-3.5" />Saved</> : "Save"}
            </Button>
          </div>
        </div>

        {/* ── Setup link ───────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <SectionHeading>Setup link</SectionHeading>
          {isBound ? (
            <p className="text-sm text-muted-foreground">
              This client is already bound. To rebind, reset the IP bindings below first — then a new setup link can be generated.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground mb-4">
                Generate a setup link with credentials and instructions. Valid for 24 hours or until a device binds.
              </p>
              {setupLink ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5">
                    <span className="flex-1 truncate font-mono text-xs text-foreground">{setupLink.url}</span>
                    <Button variant="ghost" size="sm" onClick={() => {
                      const msg = `Please follow these personal HeySummon setup instructions:\n${setupLink.url}`;
                      copyVal(msg);
                    }}>
                      {copied?.includes(setupLink.url) ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Expires {new Date(setupLink.expiresAt).toLocaleTimeString()}</span>
                    <a href={setupLink.url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
                      Preview <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                    <Button variant="ghost" size="sm" onClick={generateSetupLink} disabled={generatingLink}>Regenerate</Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={generateSetupLink} disabled={generatingLink}>
                  {generatingLink && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Generate setup link
                </Button>
              )}
            </>
          )}
        </div>

        {/* ── IP bindings ──────────────────────────────────── */}
        <div className="pt-8 mt-8 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <SectionHeading>IP bindings</SectionHeading>
            {client.ipEvents.length > 0 && (
              <Button variant="outline" size="sm" onClick={resetAllIpBindings}>Reset all</Button>
            )}
          </div>
          {client.ipEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">No IP bindings yet.</p>
          ) : (
            <div className="space-y-2">
              {client.ipEvents.map((evt) => (
                <div key={evt.id} className="rounded-md border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sm text-foreground">{evt.ip}</code>
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(evt.status)}`}>{evt.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{evt.attempts} attempts · {new Date(evt.lastSeen).toLocaleString()}</p>
                  <div className="mt-2 flex items-center gap-1">
                    {evt.status !== "allowed" && <Button variant="ghost" size="sm" onClick={() => updateIpEvent(evt.id, "allowed")}>Allow</Button>}
                    {evt.status !== "blacklisted" && <Button variant="ghost" size="sm" onClick={() => updateIpEvent(evt.id, "blacklisted")}>Blacklist</Button>}
                    <Button variant="ghost" size="sm" onClick={() => removeIpEvent(evt.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
            <AlertDialogAction onClick={async (e) => { e.preventDefault(); await deleteClient(); }} className="bg-red-600 text-white hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
