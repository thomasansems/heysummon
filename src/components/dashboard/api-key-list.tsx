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

  return (
    <div>
      <form onSubmit={handleCreate} className="mb-6 flex gap-3">
        <input
          type="text"
          value={newKeyName}
          onChange={(e) => setNewKeyName(e.target.value)}
          placeholder="Key name (optional)"
          className="flex-1 rounded-lg border border-input bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={creating}
          className="whitespace-nowrap rounded-lg bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
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
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400/80">
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
                  className="whitespace-nowrap text-xs text-amber-700 dark:text-amber-400 hover:text-amber-300"
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
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : keys.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
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
                    <code className="rounded bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      {k.key}
                    </code>
                    <button
                      onClick={() => handleCopy(k.key, k.id)}
                      className="text-xs text-orange-400 hover:text-orange-300"
                    >
                      {copiedId === k.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-500">
                    {k._count.requests} requests · Created{" "}
                    {new Date(k.createdAt).toLocaleDateString()}
                  </p>
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
