"use client";

import { useEffect, useState } from "react";

interface ApiKeyItem {
  id: string;
  key: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  _count: { requests: number };
}

export function ApiKeyList() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedInstallId, setCopiedInstallId] = useState<string | null>(null);
  const [newDeviceSecret, setNewDeviceSecret] = useState<string | null>(null);
  const [copiedDeviceSecret, setCopiedDeviceSecret] = useState(false);

  async function loadKeys() {
    const res = await fetch("/api/v1/keys");
    const data = await res.json();
    setKeys(data.keys || []);
    setLoading(false);
  }

  useEffect(() => {
    loadKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch("/api/v1/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    const data = await res.json();
    if (data.deviceSecret) {
      setNewDeviceSecret(data.deviceSecret);
    }
    setNewKeyName("");
    setCreating(false);
    await loadKeys();
  }

  async function handleDeactivate(id: string) {
    await fetch(`/api/v1/keys/${id}`, { method: "DELETE" });
    await loadKeys();
  }

  function handleCopy(key: string, id: string) {
    navigator.clipboard.writeText(key);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleCopyInstallUrl(id: string) {
    const url = `${window.location.origin}/api/v1/skill-install/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedInstallId(id);
    setTimeout(() => setCopiedInstallId(null), 2000);
  }

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-6 flex gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (optional)"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="whitespace-nowrap rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {creating ? "Creating..." : "Create Key"}
        </button>
      </form>

      {newDeviceSecret && (
        <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg">⚠️</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-amber-300">
                Device Token — Save this now!
              </p>
              <p className="mt-1 text-xs text-amber-400/80">
                This token is shown only once and cannot be retrieved later. Store it securely.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-amber-200 break-all">
                  {newDeviceSecret}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newDeviceSecret);
                    setCopiedDeviceSecret(true);
                    setTimeout(() => setCopiedDeviceSecret(false), 2000);
                  }}
                  className="whitespace-nowrap text-xs text-amber-400 hover:text-amber-300"
                >
                  {copiedDeviceSecret ? "Copied!" : "Copy"}
                </button>
              </div>
              <button
                onClick={() => setNewDeviceSecret(null)}
                className="mt-3 text-xs text-zinc-500 hover:text-zinc-400"
              >
                I&apos;ve saved it — dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          Loading...
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          No API keys yet. Create one to start receiving help requests.
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className={`rounded-xl border bg-zinc-900/50 p-4 ${
                k.isActive ? "border-zinc-800" : "border-red-500/20 opacity-60"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-zinc-200">
                      {k.name || "Unnamed Key"}
                    </p>
                    {!k.isActive && (
                      <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      {k.key}
                    </code>
                    <button
                      onClick={() => handleCopy(k.key, k.id)}
                      className="text-xs text-violet-400 hover:text-violet-300"
                    >
                      {copiedId === k.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {k._count.requests} requests · Created{" "}
                    {new Date(k.createdAt).toLocaleDateString()}
                  </p>
                  {k.isActive && (
                    <div className="mt-2">
                      <button
                        onClick={() => handleCopyInstallUrl(k.id)}
                        className="inline-flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 transition-colors"
                      >
                        {copiedInstallId === k.id ? (
                          <>✅ Link gekopieerd!</>
                        ) : (
                          <>🔌 Install in OpenClaw</>
                        )}
                      </button>
                    </div>
                  )}
                </div>
                {k.isActive && (
                  <button
                    onClick={() => handleDeactivate(k.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
