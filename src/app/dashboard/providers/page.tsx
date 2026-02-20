"use client";

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  _count: { apiKeys: number };
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadProviders = () =>
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => setProviders(data.providers || []));

  useEffect(() => {
    loadProviders();
  }, []);

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

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 12) + "•".repeat(16) + key.slice(-4);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Providers</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          Create Provider
        </button>
      </div>

      {showCreate && (
        <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-4">
          <h3 className="mb-3 text-sm font-medium text-black">New Provider</h3>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Provider name"
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

      <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
        {providers.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#666]">
            No providers yet. Create one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Provider Key</th>
                <th className="px-4 py-2.5 font-medium">Clients</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-[#eaeaea] last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-black">
                    {p.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs text-[#666]">
                        {masked(p.key)}
                      </code>
                      <button
                        onClick={() => copyKey(p.key)}
                        className="text-xs text-violet-600 hover:text-violet-800"
                      >
                        {copied === p.key ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {p._count.apiKeys}
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {new Date(p.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
