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
  openclaw: "OC",
  telegram: "TG",
};

const typeLabels: Record<string, string> = {
  openclaw: "OpenClaw",
  telegram: "Telegram",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    connected: "bg-green-50 text-green-700",
    disconnected: "bg-zinc-100 text-zinc-600",
    error: "bg-red-50 text-red-700",
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#666]">
        Loading...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Channels</h1>
        <Link
          href="/dashboard/channels/new"
          className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
        >
          New Channel
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
        {channels.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#666]">
            No channels yet. Create one to connect an external messaging platform.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
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
                  className="border-b border-[#eaeaea] last:border-0"
                >
                  <td className="px-4 py-2.5 font-medium text-black">
                    {ch.name}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-violet-50 text-[10px] font-bold text-violet-700">
                        {typeIcons[ch.type] || "?"}
                      </span>
                      <span className="text-[#666]">{typeLabels[ch.type] || ch.type}</span>
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
                  <td className="px-4 py-2.5 text-[#666]">
                    {ch.profile.name}
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {new Date(ch.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/channels/${ch.id}/settings`}
                        className="text-xs text-violet-600 hover:text-violet-800"
                      >
                        Settings
                      </Link>
                      {ch.isActive ? (
                        <button
                          onClick={() => toggleChannel(ch.id, false)}
                          className="text-xs text-red-500 hover:text-red-700"
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
                        className="text-base text-black hover:text-red-600"
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
        )}
      </div>
    </div>
  );
}
