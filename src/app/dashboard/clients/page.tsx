"use client";

import { copyToClipboard } from "@/lib/clipboard";

import { useEffect, useState } from "react";

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
  previousKeyExpiresAt: string | null;
  createdAt: string;
  machineId: string | null;
  provider: { id: string; name: string } | null;
  ipEvents: IpEvent[];
  _count: { requests: number };
}

const SCOPE_OPTIONS = ["full", "read", "write", "admin"] as const;

const scopeBadgeColors: Record<string, string> = {
  full: "bg-blue-50 text-blue-700",
  read: "bg-green-50 text-green-700",
  write: "bg-amber-50 text-amber-700",
  admin: "bg-purple-50 text-purple-700",
};

export default function ClientsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [newScope, setNewScope] = useState<string>("full");
  const [newRateLimit, setNewRateLimit] = useState(100);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [editScope, setEditScope] = useState("full");
  const [editRateLimit, setEditRateLimit] = useState(100);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);
  const [rotationResult, setRotationResult] = useState<{ key: string; deviceSecret: string; expiresAt: string } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const loadKeys = () =>
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => setKeys(data.keys || []));

  const loadProviders = () =>
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        setProviders(data.providers || []);
      });

  useEffect(() => {
    loadKeys();
    loadProviders();
  }, []);

  const createKey = async () => {
    if (!selectedProviderId) return;
    setCreating(true);
    await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName || undefined,
        providerId: selectedProviderId,
        scope: newScope,
        rateLimitPerMinute: newRateLimit,
      }),
    });
    setNewName("");
    setSelectedProviderId("");
    setNewScope("full");
    setNewRateLimit(100);
    setShowCreate(false);
    setCreating(false);
    loadKeys();
  };

  const renameKey = async (id: string) => {
    if (!editName.trim()) return;
    await fetch(`/api/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName.trim() }) });
    setEditingId(null);
    setEditName("");
    loadKeys();
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) });
    loadKeys();
  };

  const activate = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: true }) });
    loadKeys();
  };

  const deleteKey = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}"?\n\n⚠️ This will also delete ALL help requests and messages linked to this key.\n\nThis cannot be undone.`)) return;
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    loadKeys();
  };

  const rotateKey = async (id: string) => {
    if (!window.confirm("Rotate this key?\n\nA new key and device secret will be generated. The old key will remain valid for 24 hours to allow seamless migration.")) return;
    setRotating(id);
    const res = await fetch(`/api/keys/${id}/rotate`, { method: "POST" });
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

  const saveSettings = async (id: string) => {
    setSaving(true);
    await fetch(`/api/keys/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope: editScope,
        rateLimitPerMinute: editRateLimit,
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
  };

  const copyKey = (key: string) => {
    copyToClipboard(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 8) + "•".repeat(16) + key.slice(-4);

  const configSnippet = (key: string) =>
    `# HeySummon API configuration
heysummon:
  api_key: "${key}"
  endpoint: "${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/help"`;

  const isInGracePeriod = (k: ApiKey) =>
    k.previousKeyExpiresAt && new Date(k.previousKeyExpiresAt) > new Date();

  return (
    <div>
      {/* Rotation result modal */}
      {rotationResult && (
        <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <h3 className="mb-2 text-sm font-medium text-amber-900">Key Rotated Successfully</h3>
          <p className="mb-3 text-xs text-amber-800">
            Save these credentials now — the device secret will not be shown again.
            The old key remains valid until {new Date(rotationResult.expiresAt).toLocaleString()}.
          </p>
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-amber-700">New API Key</label>
              <div className="flex items-center gap-2">
                <code className="block rounded bg-white px-2 py-1 font-mono text-xs text-black">{rotationResult.key}</code>
                <button onClick={() => copyKey(rotationResult.key)} className="text-xs text-violet-600 hover:text-violet-800">Copy</button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-amber-700">New Device Secret</label>
              <div className="flex items-center gap-2">
                <code className="block rounded bg-white px-2 py-1 font-mono text-xs text-black">{rotationResult.deviceSecret}</code>
                <button onClick={() => copyKey(rotationResult.deviceSecret)} className="text-xs text-violet-600 hover:text-violet-800">Copy</button>
              </div>
            </div>
          </div>
          <button
            onClick={() => setRotationResult(null)}
            className="mt-3 rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Clients</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Create Client Key
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-black">New Client Key</h3>
          {providers.length === 0 ? (
            <p className="text-sm text-[#666]">
              No providers yet.{" "}
              <a href="/dashboard/providers" className="text-violet-600 hover:text-violet-800">
                Create a provider
              </a>{" "}
              first.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <select
                  value={selectedProviderId}
                  onChange={(e) => setSelectedProviderId(e.target.value)}
                  className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                >
                  <option value="">Select provider...</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Client name (optional)"
                  className="flex-1 rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                >
                  {SCOPE_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={newRateLimit}
                  onChange={(e) => setNewRateLimit(parseInt(e.target.value) || 100)}
                  min={1}
                  max={10000}
                  className="w-24 rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                  title="Rate limit (req/min)"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={createKey}
                  disabled={creating || !selectedProviderId}
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
        </div>
      )}

      <div className="overflow-visible rounded-lg border border-[#eaeaea] bg-white">
        {keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#666]">
            No client keys yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Key</th>
                <th className="px-4 py-2.5 font-medium">Scope</th>
                <th className="px-4 py-2.5 font-medium">Requests</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <>
                  <tr
                    key={k.id}
                    className="border-b border-[#eaeaea] last:border-0"
                  >
                    <td className="px-4 py-2.5 font-medium text-black">
                      {editingId === k.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") renameKey(k.id); if (e.key === "Escape") setEditingId(null); }}
                            className="w-32 rounded border border-[#eaeaea] px-2 py-0.5 text-sm outline-none focus:border-black"
                            autoFocus
                          />
                          <button onClick={() => renameKey(k.id)} className="text-xs text-green-600">OK</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-[#666]">X</button>
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
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {k.provider?.name || "-"}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <code className="font-mono text-xs text-[#666]">
                          {masked(k.key)}
                        </code>
                        <button
                          onClick={() => copyKey(k.key)}
                          className="text-xs text-violet-600 hover:text-violet-800"
                        >
                          {copied === k.key ? "Copied!" : "Copy"}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${scopeBadgeColors[k.scope] || "bg-gray-50 text-gray-700"}`}>
                        {k.scope}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {k._count.requests}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            !k.isActive
                              ? "bg-red-50 text-red-700"
                              : k.ipEvents?.some((e) => e.status === "allowed")
                                ? "bg-green-50 text-green-700"
                                : "bg-orange-50 text-orange-700"
                          }`}
                        >
                          {!k.isActive ? "Inactive" : k.ipEvents?.some((e) => e.status === "allowed") ? "Bound" : "No binding yet"}
                        </span>
                        {isInGracePeriod(k) && (
                          <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700" title={`Old key valid until ${new Date(k.previousKeyExpiresAt!).toLocaleString()}`}>
                            Grace
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="relative inline-block">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === k.id ? null : k.id)}
                          className="rounded-md border border-[#eaeaea] px-2 py-1 text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                        >
                          ⋯
                        </button>
                        {openMenuId === k.id && (
                          <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-[#eaeaea] bg-white py-1 shadow-lg">
                            <button
                              onClick={() => { openSettings(k); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                            >
                              Settings
                            </button>
                            <button
                              onClick={() => { setShowInstructions(showInstructions === k.id ? null : k.id); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-[#666] hover:bg-[#fafafa] hover:text-black"
                            >
                              Share
                            </button>
                            {k.isActive && (
                              <button
                                onClick={() => { rotateKey(k.id); setOpenMenuId(null); }}
                                disabled={rotating === k.id}
                                className="block w-full px-3 py-1.5 text-left text-xs text-violet-600 hover:bg-[#fafafa] hover:text-violet-800 disabled:opacity-50"
                              >
                                {rotating === k.id ? "Rotating..." : "Rotate"}
                              </button>
                            )}
                            {k.isActive ? (
                              <button
                                onClick={() => { deactivate(k.id); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-[#fafafa] hover:text-red-700"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                onClick={() => { activate(k.id); setOpenMenuId(null); }}
                                className="block w-full px-3 py-1.5 text-left text-xs text-green-600 hover:bg-[#fafafa] hover:text-green-800"
                              >
                                Activate
                              </button>
                            )}
                            <div className="my-1 border-t border-[#eaeaea]" />
                            <button
                              onClick={() => { deleteKey(k.id, k.name || "this client"); setOpenMenuId(null); }}
                              className="block w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-red-50 hover:text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                  {/* Settings row */}
                  {settingsId === k.id && (
                    <tr key={`${k.id}-settings`} className="border-b border-[#eaeaea]">
                      <td colSpan={8} className="bg-[#fafafa] px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-[#666]">Key Settings</p>
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs text-[#666]">Scope</label>
                            <select
                              value={editScope}
                              onChange={(e) => setEditScope(e.target.value)}
                              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                            >
                              {SCOPE_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs text-[#666]">Rate Limit (req/min)</label>
                            <input
                              type="number"
                              value={editRateLimit}
                              onChange={(e) => setEditRateLimit(parseInt(e.target.value) || 100)}
                              min={1}
                              max={10000}
                              className="w-24 rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                            />
                          </div>
                          <button
                            onClick={() => saveSettings(k.id)}
                            disabled={saving}
                            className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => setSettingsId(null)}
                            className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm text-[#666]"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* IP Events Section */}
                        <div className="mt-4 border-t border-[#eaeaea] pt-3">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-medium text-[#666]">IP Bindings</p>
                            {k.ipEvents?.length > 0 && (
                              <button
                                onClick={async () => {
                                  if (!window.confirm("Reset all IP bindings? The next request will bind a new IP.")) return;
                                  await fetch(`/api/keys/${k.id}/ip-events/reset`, { method: "POST" });
                                  loadKeys();
                                }}
                                className="rounded-md border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                              >
                                Reset All Bindings
                              </button>
                            )}
                          </div>
                          {!k.ipEvents || k.ipEvents.length === 0 ? (
                            <p className="text-xs text-[#999]">No IP bindings yet. The first API request will automatically bind its IP.</p>
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
                                {k.ipEvents.map((evt) => (
                                  <tr key={evt.id} className="border-t border-[#eaeaea]">
                                    <td className="py-1.5 pr-4 font-mono">{evt.ip}</td>
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
                                              await fetch(`/api/keys/${k.id}/ip-events/${evt.id}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "allowed" }),
                                              });
                                              loadKeys();
                                            }}
                                            className="rounded px-1.5 py-0.5 text-xs text-green-600 hover:bg-green-50"
                                          >
                                            Allow
                                          </button>
                                        )}
                                        {evt.status !== "blacklisted" && (
                                          <button
                                            onClick={async () => {
                                              await fetch(`/api/keys/${k.id}/ip-events/${evt.id}`, {
                                                method: "PATCH",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ status: "blacklisted" }),
                                              });
                                              loadKeys();
                                            }}
                                            className="rounded px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
                                          >
                                            Blacklist
                                          </button>
                                        )}
                                        <button
                                          onClick={async () => {
                                            await fetch(`/api/keys/${k.id}/ip-events/${evt.id}`, { method: "DELETE" });
                                            loadKeys();
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
                        </div>
                      </td>
                    </tr>
                  )}
                  {showInstructions === k.id && (
                    <tr key={`${k.id}-instructions`} className="border-b border-[#eaeaea]">
                      <td colSpan={8} className="bg-[#fafafa] px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-[#666]">
                          OpenClaw Configuration
                        </p>
                        <pre className="rounded-md bg-black p-3 font-mono text-xs text-green-400">
                          {configSnippet(k.key)}
                        </pre>
                        <button
                          onClick={() =>
                            copyToClipboard(configSnippet(k.key))
                          }
                          className="mt-2 text-xs text-violet-600 hover:text-violet-800"
                        >
                          Copy snippet
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
