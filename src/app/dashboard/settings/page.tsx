"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, KeyboardEvent } from "react";

export default function SettingsPage() {
  const { data: session } = useSession();
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notificationPref, setNotificationPref] = useState("email");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.expertise) {
          // Parse comma-separated string into tags
          const tags = data.expertise
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
          setExpertiseTags(tags);
        }
        if (data.notificationPref) setNotificationPref(data.notificationPref);
        if (data.telegramChatId) setTelegramChatId(data.telegramChatId);
      })
      .catch(() => {});
  }, []);

  const addTag = (value: string) => {
    const tag = value.trim();
    if (tag && !expertiseTags.includes(tag)) {
      setExpertiseTags([...expertiseTags, tag]);
    }
    setTagInput("");
  };

  const removeTag = (index: number) => {
    setExpertiseTags(expertiseTags.filter((_, i) => i !== index));
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && expertiseTags.length > 0) {
      removeTag(expertiseTags.length - 1);
    }
  };

  const save = async () => {
    setSaving(true);
    const expertise = expertiseTags.join(", ");
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
        <p className="mb-3 text-sm text-[#666]">
          Add your areas of expertise. Requests will be matched to providers
          based on these tags.
        </p>
        <div className="flex min-h-[42px] w-full max-w-md flex-wrap items-center gap-2 rounded-md border border-[#eaeaea] bg-white px-3 py-2 focus-within:border-black">
          {expertiseTags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2.5 py-0.5 text-sm text-black"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="ml-0.5 text-[#999] transition-colors hover:text-black"
              >
                ×
              </button>
            </span>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={() => tagInput && addTag(tagInput)}
            placeholder={
              expertiseTags.length === 0
                ? "e.g. Python, DevOps, React, AWS"
                : "Add more..."
            }
            className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-black outline-none placeholder:text-[#999]"
          />
        </div>
        <p className="mt-1.5 text-xs text-[#999]">
          Press Enter or comma to add a tag. Backspace to remove the last one.
        </p>
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
