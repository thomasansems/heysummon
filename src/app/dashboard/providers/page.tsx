"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { Fragment, useEffect, useState } from "react";

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

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface Provider {
  id: string;
  name: string;
  key: string;
  isActive: boolean;
  createdAt: string;
  timezone: string;
  ipEvents: IpEvent[];
  _count: { apiKeys: number };
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editTimezone, setEditTimezone] = useState("");
  const [timezoneFilter, setTimezoneFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const timezones = getTimezones();

  const loadProviders = () =>
    fetch("/api/providers")
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data) => { setProviders(data.providers || []); setLoading(false); })
      .catch(() => setLoading(false));

  useEffect(() => { loadProviders(); }, []);

  const createProvider = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    await fetch("/api/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setNewName("");
    setShowCreate(false);
    setCreating(false);
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
    }
    setTimezoneFilter("");
  };

  const saveProviderSettings = async (id: string) => {
    setSaving(true);
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timezone: editTimezone }),
    });
    setSaving(false);
    loadProviders();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Users</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Create User
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-medium text-foreground">New User</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="User name"
              className="flex-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              onKeyDown={(e) => e.key === "Enter" && createProvider()}
            />
            <button
              onClick={createProvider}
              disabled={creating || !newName.trim()}
              className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
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
                        <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
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
                            className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-950/40 hover:text-red-300"
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
                        className="shrink-0 text-xs text-violet-600 hover:text-violet-800"
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
                              ? "bg-red-950/60 text-red-300"
                              : p.ipEvents?.some((e) => e.status === "allowed")
                                ? "bg-green-950/60 text-green-300"
                                : "bg-orange-950/60 text-orange-300"
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
                    {/* Timezone Section */}
                    <div className="mb-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Timezone</p>
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          placeholder="Filter timezones…"
                          value={timezoneFilter}
                          onChange={(e) => setTimezoneFilter(e.target.value)}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        />
                        <select
                          value={editTimezone}
                          onChange={(e) => setEditTimezone(e.target.value)}
                          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                        >
                          {(timezoneFilter
                            ? timezones.filter((tz) =>
                                tz.toLowerCase().includes(timezoneFilter.toLowerCase())
                              )
                            : timezones
                          ).map((tz) => (
                            <option key={tz} value={tz}>
                              {tz}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => saveProviderSettings(p.id)}
                          disabled={saving}
                          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                        >
                          {saving ? "Saving..." : "Save"}
                        </button>
                      </div>
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
                                          ? "bg-green-950/60 text-green-300"
                                          : evt.status === "pending"
                                            ? "bg-amber-950/60 text-amber-300"
                                            : "bg-red-950/60 text-red-300"
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
                          className="text-xs text-violet-600 hover:text-violet-800"
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
                            ? "bg-red-950/60 text-red-300"
                            : p.ipEvents?.some((e) => e.status === "allowed")
                              ? "bg-green-950/60 text-green-300"
                              : "bg-orange-950/60 text-orange-300"
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
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-border bg-card py-1 shadow-lg">
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
                              className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-950/40 hover:text-red-300"
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
                        {/* Timezone Section */}
                        <div className="mb-4">
                          <p className="mb-2 text-xs font-medium text-muted-foreground">Timezone</p>
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              placeholder="Filter timezones…"
                              value={timezoneFilter}
                              onChange={(e) => setTimezoneFilter(e.target.value)}
                              className="max-w-xs rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                            />
                            <select
                              value={editTimezone}
                              onChange={(e) => setEditTimezone(e.target.value)}
                              className="max-w-xs rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                            >
                              {(timezoneFilter
                                ? timezones.filter((tz) =>
                                    tz.toLowerCase().includes(timezoneFilter.toLowerCase())
                                  )
                                : timezones
                              ).map((tz) => (
                                <option key={tz} value={tz}>
                                  {tz}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => saveProviderSettings(p.id)}
                              disabled={saving}
                              className="max-w-xs rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                            >
                              {saving ? "Saving..." : "Save"}
                            </button>
                          </div>
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
                                            ? "bg-green-950/60 text-green-300"
                                            : evt.status === "pending"
                                              ? "bg-amber-950/60 text-amber-300"
                                              : "bg-red-950/60 text-red-300"
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
