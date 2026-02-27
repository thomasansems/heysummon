"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

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
  }, []);

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
