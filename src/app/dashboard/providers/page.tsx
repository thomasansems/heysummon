"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { Fragment, useEffect, useState } from "react";

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
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Users</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Create User
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-black">New User</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="User name"
              className="flex-1 rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
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
              className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm text-[#666]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-visible rounded-lg border border-[#eaeaea] bg-white">
        {loading ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
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
                <tr key={i} className="border-b border-[#eaeaea] animate-pulse">
                  <td className="px-4 py-2.5"><div className="h-4 w-24 rounded bg-[#eaeaea]" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-36 rounded bg-[#eaeaea]" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-8 rounded bg-[#eaeaea]" /></td>
                  <td className="px-4 py-2.5"><div className="h-5 w-16 rounded-full bg-[#eaeaea]" /></td>
                  <td className="px-4 py-2.5"><div className="h-4 w-20 rounded bg-[#eaeaea]" /></td>
                  <td className="px-4 py-2.5 text-right"><div className="ml-auto h-6 w-8 rounded bg-[#eaeaea]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : providers.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#666]">
            No providers yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
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
                  <tr className="border-b border-[#eaeaea] last:border-0">
                    <td className="px-4 py-2.5 font-medium text-black">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameProvider(p.id);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            className="w-32 rounded border border-[#eaeaea] px-2 py-0.5 text-sm outline-none focus:border-black"
                            autoFocus
                          />
                          <button onClick={() => renameProvider(p.id)} className="text-xs text-green-600">✓</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-[#666]">✕</button>
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
                        <code className="font-mono text-xs text-[#666]">{masked(p.key)}</code>
                        <button
                          onClick={() => copyKey(p.key)}
                          className="text-xs text-violet-600 hover:text-violet-800"
                        >
                          {copied === p.key ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </td>

                    <td className="px-4 py-2.5 text-[#666]">{p._count.apiKeys}</td>

                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          !p.isActive
                            ? "bg-red-50 text-red-700"
                            : p.ipEvents?.some((e) => e.status === "allowed")
                              ? "bg-green-50 text-green-700"
                              : "bg-orange-50 text-orange-700"
                        }`}
                      >
                        {!p.isActive
                          ? "Inactive"
                          : p.ipEvents?.some((e) => e.status === "allowed")
                            ? "Bound"
                            : "No binding yet"}
                      </span>
                    </td>

                    <td className="px-4 py-2.5 text-[#666]">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>

                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                          className="rounded-md border border-[#eaeaea] px-2 py-1 text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                        >
                          ⋯
                        </button>
                        {openMenuId === p.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[#eaeaea] bg-white py-1 shadow-lg">
                            <button
                              onClick={() => { openSettings(p); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                            >
                              IP Security
                            </button>
                            <a
                              href={`/dashboard/providers/${p.id}/settings`}
                              className="block w-full px-3 py-1.5 text-left text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                              onClick={() => setOpenMenuId(null)}
                            >
                              Settings
                            </a>
                            {p.isActive ? (
                              <button
                                onClick={() => { toggleProvider(p.id, false); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-[#fafafa] hover:text-red-700"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => { toggleProvider(p.id, true); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-[#fafafa] hover:text-green-800"
                              >
                                Activate
                              </button>
                            )}
                            <div className="my-1 border-t border-[#eaeaea]" />
                            <button
                              onClick={() => { deleteProvider(p.id, p.name); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* IP Security inline panel */}
                  {settingsId === p.id && (
                    <tr key={`${p.id}-settings`} className="border-b border-[#eaeaea]">
                      <td colSpan={6} className="bg-[#fafafa] px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-[#666]">IP Security</p>
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
                              className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                            >
                              Reset All Bindings
                            </button>
                          )}
                        </div>

                        {!p.ipEvents || p.ipEvents.length === 0 ? (
                          <p className="text-xs text-[#999]">
                            No IP bindings yet. The first API request from this provider will automatically bind its IP.
                          </p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-[#999]">
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
                                <tr key={evt.id} className="border-t border-[#eaeaea]">
                                  <td className="py-1.5 pr-4 font-mono text-[#666]">{evt.ip}</td>
                                  <td className="py-1.5 pr-4">
                                    <span
                                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                        evt.status === "allowed"
                                          ? "bg-green-50 text-green-700"
                                          : evt.status === "pending"
                                            ? "bg-amber-50 text-amber-700"
                                            : "bg-red-50 text-red-700"
                                      }`}
                                    >
                                      {evt.status}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-4 text-[#666]">{evt.attempts}</td>
                                  <td className="py-1.5 pr-4 text-[#666]">{new Date(evt.firstSeen).toLocaleString()}</td>
                                  <td className="py-1.5 pr-4 text-[#666]">{new Date(evt.lastSeen).toLocaleString()}</td>
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
                                        className="rounded px-1.5 py-0.5 text-xs text-[#999] hover:bg-[#f0f0f0] hover:text-[#666]"
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
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
