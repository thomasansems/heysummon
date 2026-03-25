"use client";

import { useEffect, useState, useCallback } from "react";
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
  const [regenerating, setRegenerating] = useState(false);

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

  const regenerateSetupToken = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/channels/${params.id}/regenerate-token`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setChannel((prev) => prev ? { ...prev, config: JSON.stringify(data.config) } : prev);
      }
    } catch { /* ignore */ }
    setRegenerating(false);
  }, [params.id]);

  if (!channel) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Channels
        </button>
        <h1 className="text-2xl font-semibold text-foreground">
          {channel.name} — Settings
        </h1>
      </div>

      <div className="space-y-6">
        {/* General */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">General</h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full max-w-sm rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
              />
            </div>
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Type</span>
                <p className="font-medium text-foreground">{typeLabels[channel.type] || channel.type}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Status</span>
                <p className={`font-medium ${channel.status === "connected" ? "text-green-400" : channel.status === "error" ? "text-red-400" : "text-zinc-600"}`}>
                  {channel.status}
                </p>
              </div>
              {channel.lastHeartbeat && (
                <div>
                  <span className="text-xs text-muted-foreground">Last Heartbeat</span>
                  <p className="text-foreground">{new Date(channel.lastHeartbeat).toLocaleString()}</p>
                </div>
              )}
            </div>
            {channel.errorMessage && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-400">
                {channel.errorMessage}
              </div>
            )}
          </div>
        </div>

        {/* Type-specific settings */}
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-medium text-foreground">
            {typeLabels[channel.type]} Configuration
          </h2>
          {channel.type === "openclaw" && (
            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">API Key</span>
                <p className="font-mono text-sm text-foreground">
                  {typeof config.apiKey === "string"
                    ? config.apiKey.slice(0, 8) + "..." + config.apiKey.slice(-4)
                    : "Not set"}
                </p>
              </div>
            </div>
          )}
          {channel.type === "telegram" && (
            <div className="space-y-3">
              <div>
                <span className="text-xs text-muted-foreground">Bot Username</span>
                <p className="text-sm text-foreground">
                  {typeof config.botUsername === "string" ? `@${config.botUsername}` : "Not set"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Bot Token</span>
                <p className="font-mono text-sm text-foreground">
                  {typeof config.botToken === "string"
                    ? config.botToken.slice(0, 10) + "..." + config.botToken.slice(-4)
                    : "Not set"}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Chat Binding</span>
                {config.providerChatId ? (
                  <p className="text-sm text-green-600">
                    Connected (chat {String(config.providerChatId).slice(0, 6)}...)
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">Not connected yet</p>
                )}
              </div>

              {/* Setup link or regenerate */}
              <div className="rounded-md border border-border bg-muted/30 p-3">
                {typeof config.setupToken === "string" && typeof config.botUsername === "string" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Open this link in Telegram to bind your chat:
                    </p>
                    <a
                      href={`https://t.me/${config.botUsername}?start=${config.setupToken}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all font-mono text-sm text-blue-500 hover:underline"
                    >
                      https://t.me/{String(config.botUsername)}?start={String(config.setupToken)}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      This is a one-time link. It will be invalidated after use.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {config.providerChatId
                        ? "Chat is already bound. Regenerate to re-pair with a different Telegram account."
                        : "Generate a setup link to bind your Telegram account."}
                    </p>
                    <button
                      onClick={regenerateSetupToken}
                      disabled={regenerating}
                      className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {regenerating ? "Generating..." : config.providerChatId ? "Regenerate Setup Link" : "Generate Setup Link"}
                    </button>
                  </div>
                )}
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
        <div className="rounded-lg border border-red-200 bg-card p-5">
          <h2 className="mb-1 text-sm font-medium text-red-400">Danger Zone</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Permanently delete this channel. All associated data will be lost.
          </p>
          <button
            onClick={handleDelete}
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-400 transition-colors hover:bg-red-100"
          >
            Delete Channel
          </button>
        </div>
      </div>
    </div>
  );
}
