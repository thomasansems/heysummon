"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useCallback } from "react";

interface IpEvent {
  id: string;
  ip: string;
  status: string;
  attempts: number;
  firstSeen: string;
  lastSeen: string;
}

interface ProviderProfile {
  id: string;
  name: string;
  key: string;
  ipEvents: IpEvent[];
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const [notificationPref, setNotificationPref] = useState("email");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [retention, setRetention] = useState<{
    retentionDays: number | null;
    enabled: boolean;
    stats: { totalRequests: number; expiredRequests: number; totalAuditLogs: number };
  } | null>(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupDone, setCleanupDone] = useState(false);
  const [providerProfiles, setProviderProfiles] = useState<ProviderProfile[]>([]);

  const fetchProviderIpEvents = useCallback(() => {
    fetch("/api/providers/ip-events")
      .then((r) => r.json())
      .then((data) => setProviderProfiles(data.profiles || []))
      .catch(() => {});
  }, []);

  const updateIpStatus = async (eventId: string, status: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchProviderIpEvents();
  };

  const deleteIpEvent = async (eventId: string) => {
    await fetch(`/api/providers/ip-events/${eventId}`, { method: "DELETE" });
    fetchProviderIpEvents();
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.notificationPref) setNotificationPref(data.notificationPref);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
      })
      .catch(() => {});

    fetch("/api/admin/retention")
      .then((r) => r.json())
      .then((data) => setRetention(data))
      .catch(() => {});

    fetchProviderIpEvents();
  }, [fetchProviderIpEvents]);

  const triggerCleanup = async () => {
    setCleanupRunning(true);
    setCleanupDone(false);
    await fetch("/api/admin/retention", { method: "POST" });
    const updated = await fetch("/api/admin/retention").then((r) => r.json());
    setRetention(updated);
    setCleanupRunning(false);
    setCleanupDone(true);
    setTimeout(() => setCleanupDone(false), 3000);
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationPref, telegramChatId }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-black">Settings</h1>

      {/* Profile */}
      <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-black">Profile</h2>
        <div className="flex items-center gap-4">
          {session?.user?.image ? (
            <img
              src={session.user.image}
              alt=""
              className="h-12 w-12 rounded-full"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#eaeaea] text-lg font-medium text-[#666]">
              {session?.user?.name?.[0] || "?"}
            </div>
          )}
          <div>
            <p className="font-medium text-black">
              {session?.user?.name || "—"}
            </p>
            <p className="text-sm text-[#666]">
              {session?.user?.email || "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-black">Notifications</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-[#666]">
              Notification Preference
            </label>
            <select
              value={notificationPref}
              onChange={(e) => setNotificationPref(e.target.value)}
              className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
            >
              <option value="email">Email</option>
              <option value="telegram">Telegram</option>
              <option value="both">Both</option>
            </select>
          </div>
          {(notificationPref === "telegram" ||
            notificationPref === "both") && (
            <div>
              <label className="mb-1 block text-sm text-[#666]">
                Telegram Chat ID
              </label>
              <input
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="Your Telegram chat ID"
                className="w-full max-w-xs rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
              />
            </div>
          )}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </button>

      {/* Provider IP Security */}
      {providerProfiles.length > 0 && (
        <div className="mt-6 rounded-lg border border-[#eaeaea] bg-white p-6">
          <h2 className="mb-1 text-sm font-medium text-black">Provider IP Security</h2>
          <p className="mb-4 text-xs text-[#666]">
            Manage which IP addresses can use your provider keys. New IPs are automatically held as &quot;pending&quot; until you approve them.
          </p>

          {providerProfiles.map((profile) => (
            <div key={profile.id} className="mb-4 last:mb-0">
              <h3 className="mb-2 text-sm font-medium text-[#333]">
                {profile.name}{" "}
                <span className="font-mono text-xs text-[#999]">
                  {profile.key.slice(0, 12)}...
                </span>
              </h3>

              {profile.ipEvents.length === 0 ? (
                <p className="text-xs text-[#999]">
                  No IP events yet. The first request will auto-bind.
                </p>
              ) : (
                <div className="space-y-2">
                  {profile.ipEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between rounded-md border border-[#eaeaea] px-3 py-2"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            evt.status === "allowed"
                              ? "bg-green-50 text-green-700"
                              : evt.status === "blacklisted"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {evt.status}
                        </span>
                        <span className="font-mono text-sm text-black">{evt.ip}</span>
                        <span className="text-xs text-[#999]">
                          {evt.attempts > 1 && `${evt.attempts} attempts · `}
                          Last seen {new Date(evt.lastSeen).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {evt.status !== "allowed" && (
                          <button
                            onClick={() => updateIpStatus(evt.id, "allowed")}
                            className="rounded border border-green-200 px-2 py-1 text-xs text-green-700 hover:bg-green-50"
                          >
                            Allow
                          </button>
                        )}
                        {evt.status !== "blacklisted" && (
                          <button
                            onClick={() => updateIpStatus(evt.id, "blacklisted")}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                          >
                            Block
                          </button>
                        )}
                        <button
                          onClick={() => deleteIpEvent(evt.id)}
                          className="rounded border border-[#eaeaea] px-2 py-1 text-xs text-[#666] hover:bg-[#fafafa]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Data Retention */}
      {retention && (
        <div className="mt-6 rounded-lg border border-[#eaeaea] bg-white p-6">
          <h2 className="mb-1 text-sm font-medium text-black">Data Retention</h2>
          <p className="mb-4 text-xs text-[#666]">
            {retention.enabled
              ? `Auto-cleanup enabled — records older than ${retention.retentionDays} days are removed.`
              : "Auto-cleanup disabled. Set HEYSUMMON_RETENTION_DAYS in your environment to enable."}
          </p>

          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-[#eaeaea] p-3 text-center">
              <p className="text-lg font-medium text-black">{retention.stats.totalRequests}</p>
              <p className="text-xs text-[#666]">Total requests</p>
            </div>
            <div className="rounded-md border border-[#eaeaea] p-3 text-center">
              <p className="text-lg font-medium text-black">{retention.stats.expiredRequests}</p>
              <p className="text-xs text-[#666]">Expired / closed</p>
            </div>
            <div className="rounded-md border border-[#eaeaea] p-3 text-center">
              <p className="text-lg font-medium text-black">{retention.stats.totalAuditLogs}</p>
              <p className="text-xs text-[#666]">Audit log entries</p>
            </div>
          </div>

          {retention.enabled && (
            <button
              onClick={triggerCleanup}
              disabled={cleanupRunning}
              className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm text-black transition-colors hover:bg-[#fafafa] disabled:opacity-50"
            >
              {cleanupRunning ? "Cleaning up..." : cleanupDone ? "Done!" : "Run cleanup now"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
