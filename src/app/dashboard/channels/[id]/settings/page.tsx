"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface ChannelData {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  status: string;
  errorMessage: string | null;
  lastHeartbeat: string | null;
  config: string;
  createdAt: string;
}

const typeLabels: Record<string, string> = {
  openclaw: "OpenClaw",
  telegram: "Telegram",
};

export default function ChannelSettingsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/channels/${params.id}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then(({ channel: ch }: { channel: ChannelData }) => {
        setChannel(ch);
        setName(ch.name);
      })
      .catch(() => router.push("/dashboard/channels"));
  }, [params.id, router]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSaved(false);

    const res = await fetch(`/api/channels/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
    } else {
      const data = await res.json();
      setChannel(data.channel);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!channel) return;
    if (!window.confirm(`Delete channel "${channel.name}"? This cannot be undone.`)) return;

    await fetch(`/api/channels/${params.id}`, { method: "DELETE" });
    router.push("/dashboard/channels");
  };

  if (!channel) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#666]">
        Loading...
      </div>
    );
  }

  const config = JSON.parse(channel.config) as Record<string, unknown>;

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => router.push("/dashboard/channels")}
          className="text-sm text-[#666] hover:text-black"
        >
          ← Channels
        </button>
        <h1 className="text-2xl font-semibold text-black">
          {channel.name} — Settings
        </h1>
      </div>

      <div className="space-y-6">
        {/* General */}
        <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-black">General</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#666]">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-sm rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
              />
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-xs text-[#666]">Type</span>
                <p className="font-medium text-black">{typeLabels[channel.type] || channel.type}</p>
              </div>
              <div>
                <span className="text-xs text-[#666]">Status</span>
                <p className={`font-medium ${channel.status === "connected" ? "text-green-700" : channel.status === "error" ? "text-red-700" : "text-zinc-600"}`}>
                  {channel.status}
                </p>
              </div>
              {channel.lastHeartbeat && (
                <div>
                  <span className="text-xs text-[#666]">Last Heartbeat</span>
                  <p className="text-black">{new Date(channel.lastHeartbeat).toLocaleString()}</p>
                </div>
              )}
            </div>
            {channel.errorMessage && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                {channel.errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Type-specific settings */}
        <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
          <h2 className="mb-3 text-sm font-medium text-black">
            {typeLabels[channel.type]} Configuration
          </h2>
          {channel.type === "openclaw" && (
            <div className="space-y-2">
              <div>
                <span className="text-xs text-[#666]">API Key</span>
                <p className="font-mono text-sm text-black">
                  {typeof config.apiKey === "string"
                    ? config.apiKey.slice(0, 8) + "..." + config.apiKey.slice(-4)
                    : "Not set"}
                </p>
              </div>
            </div>
          )}
          {channel.type === "telegram" && (
            <div className="space-y-2">
              <div>
                <span className="text-xs text-[#666]">Bot Username</span>
                <p className="text-sm text-black">
                  {typeof config.botUsername === "string" ? `@${config.botUsername}` : "Not set"}
                </p>
              </div>
              <div>
                <span className="text-xs text-[#666]">Bot Token</span>
                <p className="font-mono text-sm text-black">
                  {typeof config.botToken === "string"
                    ? config.botToken.slice(0, 10) + "..." + config.botToken.slice(-4)
                    : "Not set"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {saved && <span className="text-sm text-green-600">Settings saved</span>}
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>

        {/* Danger Zone */}
        <div className="rounded-lg border border-red-200 bg-white p-5">
          <h2 className="mb-1 text-sm font-medium text-red-700">Danger Zone</h2>
          <p className="mb-3 text-xs text-[#666]">
            Permanently delete this channel. All associated data will be lost.
          </p>
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Delete Channel
          </button>
        </div>
      </div>
    </div>
  );
}
