"use client";

import { useEffect, useState, useCallback } from "react";

interface Provider {
  id: string;
  name: string;
}

interface Channel {
  id: string;
  providerId: string;
  type: string;
  config: string | null;
  isActive: boolean;
  isPrimary: boolean;
  createdAt: string;
}

const CHANNEL_TYPE_OPTIONS = [
  { value: "telegram", label: "Telegram", configLabel: "Chat ID", configPlaceholder: "e.g. 123456789" },
  { value: "whatsapp", label: "WhatsApp", configLabel: "Phone number", configPlaceholder: "e.g. +31612345678" },
  { value: "signal", label: "Signal", configLabel: "Phone number", configPlaceholder: "e.g. +31612345678" },
  { value: "discord", label: "Discord", configLabel: "Webhook URL", configPlaceholder: "e.g. https://discord.com/api/webhooks/..." },
  { value: "email", label: "Email", configLabel: "Email address", configPlaceholder: "e.g. expert@example.com" },
] as const;

export default function ChannelsPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [channels, setChannels] = useState<Record<string, Channel[]>>({});
  const [showAdd, setShowAdd] = useState<string | null>(null);
  const [addType, setAddType] = useState("telegram");
  const [addConfig, setAddConfig] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProviders = useCallback(async () => {
    const res = await fetch("/api/providers");
    const data = await res.json();
    setProviders(data.providers || []);
  }, []);

  const loadChannels = useCallback(async (providerId: string) => {
    const res = await fetch(`/api/providers/${providerId}/channels`);
    const data = await res.json();
    setChannels((prev) => ({ ...prev, [providerId]: data.channels || [] }));
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    providers.forEach((p) => loadChannels(p.id));
  }, [providers, loadChannels]);

  const addChannel = async (providerId: string) => {
    if (!addType) return;
    setCreating(true);
    await fetch(`/api/providers/${providerId}/channels`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: addType,
        config: addConfig.trim() || null,
      }),
    });
    setShowAdd(null);
    setAddType("telegram");
    setAddConfig("");
    setCreating(false);
    loadChannels(providerId);
  };

  const toggleActive = async (providerId: string, channelId: string, isActive: boolean) => {
    await fetch(`/api/providers/${providerId}/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadChannels(providerId);
  };

  const setPrimary = async (providerId: string, channelId: string) => {
    await fetch(`/api/providers/${providerId}/channels/${channelId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: true }),
    });
    loadChannels(providerId);
  };

  const removeChannel = async (providerId: string, channelId: string, type: string) => {
    if (!window.confirm(`Remove ${type} channel? This cannot be undone.`)) return;
    await fetch(`/api/providers/${providerId}/channels/${channelId}`, {
      method: "DELETE",
    });
    loadChannels(providerId);
  };

  const configMeta = CHANNEL_TYPE_OPTIONS.find((o) => o.value === addType);
  const existingTypes = (providerId: string) =>
    (channels[providerId] || []).map((c) => c.type);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-black">Channels</h1>
        <p className="mt-1 text-sm text-[#666]">
          Configure notification channels for each provider. The primary channel receives help-request notifications first.
        </p>
      </div>

      {providers.length === 0 ? (
        <div className="rounded-lg border border-[#eaeaea] bg-white p-8 text-center text-sm text-[#666]">
          No providers yet. Create a provider first on the Providers page.
        </div>
      ) : (
        providers.map((provider) => (
          <div key={provider.id} className="mb-6 rounded-lg border border-[#eaeaea] bg-white">
            <div className="flex items-center justify-between border-b border-[#eaeaea] px-4 py-3">
              <h2 className="text-sm font-medium text-black">{provider.name}</h2>
              <button
                onClick={() => {
                  setShowAdd(showAdd === provider.id ? null : provider.id);
                  setAddType("telegram");
                  setAddConfig("");
                }}
                className="rounded-md bg-black px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-black/90"
              >
                Add Channel
              </button>
            </div>

            {showAdd === provider.id && (
              <div className="border-b border-[#eaeaea] bg-[#fafafa] px-4 py-3">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#666]">Type</label>
                    <select
                      value={addType}
                      onChange={(e) => setAddType(e.target.value)}
                      className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                    >
                      {CHANNEL_TYPE_OPTIONS.filter(
                        (o) => !existingTypes(provider.id).includes(o.value)
                      ).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-[#666]">
                      {configMeta?.configLabel || "Config"}
                    </label>
                    <input
                      value={addConfig}
                      onChange={(e) => setAddConfig(e.target.value)}
                      placeholder={configMeta?.configPlaceholder || ""}
                      className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                      onKeyDown={(e) => e.key === "Enter" && addChannel(provider.id)}
                    />
                  </div>
                  <button
                    onClick={() => addChannel(provider.id)}
                    disabled={creating}
                    className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {creating ? "Adding..." : "Add"}
                  </button>
                  <button
                    onClick={() => setShowAdd(null)}
                    className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm text-[#666]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(channels[provider.id] || []).length === 0 ? (
              <div className="p-6 text-center text-sm text-[#666]">
                No channels configured. Add one to start receiving notifications.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#eaeaea] text-left text-[#666]">
                    <th className="px-4 py-2.5 font-medium">Channel</th>
                    <th className="px-4 py-2.5 font-medium">Config</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(channels[provider.id] || []).map((ch) => (
                    <tr key={ch.id} className="border-b border-[#eaeaea] last:border-0">
                      <td className="px-4 py-2.5 font-medium text-black">
                        <span className="capitalize">{ch.type}</span>
                        {ch.isPrimary && (
                          <span className="ml-2 inline-flex rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                            Primary
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[#666]">
                        <code className="text-xs">{ch.config || "—"}</code>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            ch.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-red-50 text-red-700"
                          }`}
                        >
                          {ch.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!ch.isPrimary && (
                            <button
                              onClick={() => setPrimary(provider.id, ch.id)}
                              className="text-xs text-violet-600 hover:text-violet-800"
                            >
                              Set Primary
                            </button>
                          )}
                          {ch.isActive ? (
                            <button
                              onClick={() => toggleActive(provider.id, ch.id, false)}
                              className="text-xs text-red-500 hover:text-red-700"
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleActive(provider.id, ch.id, true)}
                              className="text-xs text-green-600 hover:text-green-800"
                            >
                              Activate
                            </button>
                          )}
                          <button
                            onClick={() => removeChannel(provider.id, ch.id, ch.type)}
                            className="text-base text-black hover:text-red-600"
                            title="Remove"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))
      )}
    </div>
  );
}
