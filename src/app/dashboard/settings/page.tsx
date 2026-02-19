"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [expertise, setExpertise] = useState("");
  const [notificationPref, setNotificationPref] = useState("email");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.expertise) setExpertise(data.expertise);
        if (data.notificationPref) setNotificationPref(data.notificationPref);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expertise, notificationPref, telegramChatId }),
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

      {/* Expertise */}
      <div className="mb-6 rounded-lg border border-[#eaeaea] bg-white p-6">
        <h2 className="mb-4 text-sm font-medium text-black">Expertise</h2>
        <div>
          <label className="mb-1 block text-sm text-[#666]">
            Tags (comma-separated)
          </label>
          <input
            value={expertise}
            onChange={(e) => setExpertise(e.target.value)}
            placeholder="e.g. Python, DevOps, React, AWS"
            className="w-full max-w-md rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
          />
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
      </button>
    </div>
  );
}
