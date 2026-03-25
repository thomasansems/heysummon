"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ChannelProvider {
  id: string;
  type: string;
  name: string;
  isActive: boolean;
  status: string;
  errorMessage: string | null;
  lastHeartbeat: string | null;
  createdAt: string;
  profile: { id: string; name: string };
}

const typeIcons: Record<string, string> = {
  openclaw: "/icons/openclaw.svg",
  telegram: "/icons/telegram.svg",
  signal: "/icons/signal.svg",
  slack: "/icons/slack.svg",
  whatsapp: "/icons/whatsapp.svg",
};

const typeLabels: Record<string, string> = {
  openclaw: "OpenClaw",
  telegram: "Telegram",
  slack: "Slack",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300",
    disconnected: "bg-zinc-100 text-zinc-600",
    error: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.disconnected}`}>
      {status}
    </span>
  );
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelProvider[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChannels = () =>
    fetch("/api/channels")
      .then((r) => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then((data) => {
        setChannels(data.channels || []);
        setLoading(false);
      });

  useEffect(() => {
    loadChannels();
  }, []);

  const toggleChannel = async (id: string, isActive: boolean) => {
    await fetch(`/api/channels/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    loadChannels();
  };

  const deleteChannel = async (id: string, name: string) => {
    if (!window.confirm(`Delete channel "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/channels/${id}`, { method: "DELETE" });
    loadChannels();
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground">Channels</h1>
      </div>

      {/* Connect a channel */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Connect a channel</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { type: "openclaw", icon: "/icons/openclaw.svg", label: "OpenClaw", enabled: true },
            { type: "telegram", icon: "/icons/telegram.svg", label: "Telegram", enabled: true },
            { type: "slack", icon: "/icons/slack.svg", label: "Slack", enabled: true },
            { type: "whatsapp", icon: "/icons/whatsapp.svg", label: "WhatsApp", enabled: false },
          ].map((ch) => (
            <Link
              key={ch.type}
              href={ch.enabled ? "/dashboard/channels/new" : "#"}
              onClick={(e) => !ch.enabled && e.preventDefault()}
              className={`flex items-center gap-2.5 rounded-lg border border-border bg-card px-4 py-3 transition-colors ${
                ch.enabled ? "hover:border-black" : "cursor-default opacity-50"
              }`}
            >
              <img src={ch.icon} alt={ch.label} className="h-7 w-7 rounded" />
              <div>
                <span className="text-sm font-medium text-foreground">{ch.label}</span>
                {!ch.enabled && <p className="text-[10px] text-muted-foreground">Coming soon</p>}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {loading ? (
          <>
          <div className="md:hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-b border-border p-4 space-y-3 last:border-0 animate-pulse">
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-4 w-28 rounded bg-muted"></div></div>
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-4 w-20 rounded bg-muted"></div></div>
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-5 w-24 rounded-full bg-muted"></div></div>
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-4 w-24 rounded bg-muted"></div></div>
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-4 w-20 rounded bg-muted"></div></div>
                <div><div className="h-3 w-12 rounded bg-muted mb-1"></div><div className="h-4 w-32 rounded bg-muted"></div></div>
              </div>
            ))}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Profile</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3].map((i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-28 rounded bg-muted"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <div className="h-5 w-5 rounded bg-muted"></div>
                      <div className="h-4 w-20 rounded bg-muted"></div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-5 w-24 rounded-full bg-muted"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-24 rounded bg-muted"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-20 rounded bg-muted"></div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-32 rounded bg-muted"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        ) : channels.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No channels yet. Create one to connect an external messaging platform.
          </div>
        ) : (
          <>
          <div className="md:hidden">
            {channels.map((ch) => (
              <div key={ch.id} className="border-b border-border p-4 space-y-3 last:border-0">
                <div><span className="text-xs text-muted-foreground">Name</span><div className="font-medium text-foreground">{ch.name}</div></div>
                <div>
                  <span className="text-xs text-muted-foreground">Type</span>
                  <div className="inline-flex items-center gap-1.5">
                    <img src={typeIcons[ch.type] || "/icons/openclaw.svg"} alt={ch.type} className="h-5 w-5 rounded" />
                    <span className="text-muted-foreground">{typeLabels[ch.type] || ch.type}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Status</span>
                  <div>
                    <StatusBadge status={ch.status} />
                    {ch.errorMessage && (
                      <span className="ml-2 text-xs text-red-500" title={ch.errorMessage}>(!)</span>
                    )}
                  </div>
                </div>
                <div><span className="text-xs text-muted-foreground">Profile</span><div className="text-muted-foreground">{ch.profile.name}</div></div>
                <div><span className="text-xs text-muted-foreground">Created</span><div className="text-muted-foreground">{new Date(ch.createdAt).toLocaleDateString()}</div></div>
                <div>
                  <span className="text-xs text-muted-foreground">Actions</span>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/channels/${ch.id}/settings`}
                      className="text-xs text-orange-600 hover:text-orange-800"
                    >
                      Settings
                    </Link>
                    {ch.isActive ? (
                      <button
                        onClick={() => toggleChannel(ch.id, false)}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleChannel(ch.id, true)}
                        className="text-xs text-green-600 hover:text-green-800"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => deleteChannel(ch.id, ch.name)}
                      className="text-base text-foreground hover:text-red-600"
                      title="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <table className="hidden md:table w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Profile</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr
                  key={ch.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-foreground">
                    {ch.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <img src={typeIcons[ch.type] || "/icons/openclaw.svg"} alt={ch.type} className="h-5 w-5 rounded" />
                      <span className="text-muted-foreground">{typeLabels[ch.type] || ch.type}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={ch.status} />
                    {ch.errorMessage && (
                      <span className="ml-2 text-xs text-red-500" title={ch.errorMessage}>
                        (!)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {ch.profile.name}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(ch.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/channels/${ch.id}/settings`}
                        className="text-xs text-orange-600 hover:text-orange-800"
                      >
                        Settings
                      </Link>
                      {ch.isActive ? (
                        <button
                          onClick={() => toggleChannel(ch.id, false)}
                          className="text-xs text-red-500 hover:text-red-400"
                        >
                          Deactivate
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleChannel(ch.id, true)}
                          className="text-xs text-green-600 hover:text-green-800"
                        >
                          Activate
                        </button>
                      )}
                      <button
                        onClick={() => deleteChannel(ch.id, ch.name)}
                        className="text-base text-foreground hover:text-red-600"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}
