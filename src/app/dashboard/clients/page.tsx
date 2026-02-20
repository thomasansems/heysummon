"use client";

import { useEffect, useState } from "react";

interface Provider {
  id: string;
  name: string;
}

interface ApiKey {
  id: string;
  key: string;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  provider: { id: string; name: string } | null;
  _count: { requests: number };
}

export default function ClientsPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState<string | null>(null);

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
      body: JSON.stringify({ name: newName || undefined, providerId: selectedProviderId }),
    });
    setNewName("");
    setSelectedProviderId("");
    setShowCreate(false);
    setCreating(false);
    loadKeys();
  };

  const deactivate = async (id: string) => {
    await fetch(`/api/keys/${id}`, { method: "DELETE" });
    loadKeys();
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const masked = (key: string) =>
    key.slice(0, 8) + "•".repeat(16) + key.slice(-4);

  const configSnippet = (key: string) =>
    `# OpenClaw config for HITLaaS
hitlaas:
  api_key: "${key}"
  endpoint: "https://hitlaas.vercel.app/api/v1/help"`;

  return (
    <div>
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

      <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
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
                      {k.name || "Unnamed"}
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {k.provider?.name || "—"}
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
                    <td className="px-4 py-2.5 text-[#666]">
                      {k._count.requests}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          k.isActive
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {k.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setShowInstructions(
                              showInstructions === k.id ? null : k.id
                            )
                          }
                          className="text-xs text-[#666] hover:text-black"
                        >
                          Share
                        </button>
                        {k.isActive && (
                          <button
                            onClick={() => deactivate(k.id)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {showInstructions === k.id && (
                    <tr key={`${k.id}-instructions`} className="border-b border-[#eaeaea]">
                      <td colSpan={7} className="bg-[#fafafa] px-4 py-3">
                        <p className="mb-2 text-xs font-medium text-[#666]">
                          OpenClaw Configuration
                        </p>
                        <pre className="rounded-md bg-black p-3 font-mono text-xs text-green-400">
                          {configSnippet(k.key)}
                        </pre>
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(configSnippet(k.key))
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
