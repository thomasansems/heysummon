"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  name: string;
}

type ChannelType = "openclaw" | "telegram" | null;

const channelTypes = [
  {
    type: "openclaw" as const,
    label: "OpenClaw",
    icon: "OC",
    description: "Connect an OpenClaw AI agent to receive help requests",
  },
  {
    type: "telegram" as const,
    label: "Telegram",
    icon: "TG",
    description: "Receive help requests via a Telegram bot",
  },
  {
    type: null,
    label: "WhatsApp",
    icon: "WA",
    description: "Coming soon",
    disabled: true,
  },
];

export default function NewChannelPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ChannelType>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");

  // Form fields
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [botToken, setBotToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/providers")
      .then((r) => r.json())
      .then((data) => {
        const list = data.providers || [];
        setProfiles(list);
        if (list.length === 1) setSelectedProfileId(list[0].id);
      });
  }, []);

  const handleTypeSelect = (type: ChannelType) => {
    if (!type) return;
    setSelectedType(type);
    setStep(2);
  };

  const handleCreate = async () => {
    if (!selectedType || !name.trim() || !selectedProfileId) return;

    setCreating(true);
    setError("");

    const config: Record<string, string> = {};
    if (selectedType === "openclaw") {
      if (!apiKey.trim()) {
        setError("API key is required");
        setCreating(false);
        return;
      }
      config.apiKey = apiKey.trim();
    } else if (selectedType === "telegram") {
      if (!botToken.trim()) {
        setError("Bot token is required");
        setCreating(false);
        return;
      }
      config.botToken = botToken.trim();
    }

    const res = await fetch("/api/channels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: selectedProfileId,
        type: selectedType,
        name: name.trim(),
        config,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to create channel");
      setCreating(false);
      return;
    }

    router.push("/dashboard/channels");
  };

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => (step === 2 ? setStep(1) : router.push("/dashboard/channels"))}
          className="text-sm text-[#666] hover:text-black"
        >
          {step === 2 ? "← Back" : "← Channels"}
        </button>
        <h1 className="text-2xl font-semibold text-black">New Channel</h1>
      </div>

      {step === 1 && (
        <div>
          <p className="mb-4 text-sm text-[#666]">
            Choose the type of channel you want to connect.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {channelTypes.map((ct) => (
              <button
                key={ct.label}
                onClick={() => handleTypeSelect(ct.type)}
                disabled={ct.disabled}
                className={`rounded-lg border border-[#eaeaea] bg-white p-5 text-left transition-colors ${
                  ct.disabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:border-black"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-violet-50 text-xs font-bold text-violet-700">
                    {ct.icon}
                  </span>
                  <span className="text-sm font-medium text-black">{ct.label}</span>
                </div>
                <p className="text-xs text-[#666]">{ct.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && selectedType && (
        <div className="max-w-md space-y-4">
          <div className="rounded-lg border border-[#eaeaea] bg-white p-5">
            <h2 className="mb-4 text-sm font-medium text-black">
              Configure {selectedType === "openclaw" ? "OpenClaw" : "Telegram"} Channel
            </h2>

            {profiles.length === 0 ? (
              <p className="text-sm text-[#666]">
                No user profiles yet.{" "}
                <a href="/dashboard/providers" className="text-violet-600 hover:text-violet-800">
                  Create one
                </a>{" "}
                first.
              </p>
            ) : (
              <div className="space-y-3">
                {profiles.length > 1 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#666]">
                      Profile
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                    >
                      <option value="">Select profile...</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#666]">
                    Channel Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={selectedType === "openclaw" ? "My OpenClaw Agent" : "Support Bot"}
                    className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black outline-none focus:border-black"
                  />
                </div>

                {selectedType === "openclaw" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#666]">
                      API Key
                    </label>
                    <input
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="oc_..."
                      className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 font-mono text-sm text-black outline-none focus:border-black"
                    />
                  </div>
                )}

                {selectedType === "telegram" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-[#666]">
                      Bot Token
                    </label>
                    <input
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdef..."
                      className="w-full rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 font-mono text-sm text-black outline-none focus:border-black"
                    />
                    <p className="mt-1 text-xs text-[#666]">
                      Get a bot token from{" "}
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-violet-600 hover:text-violet-800"
                      >
                        @BotFather
                      </a>{" "}
                      on Telegram.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleCreate}
                    disabled={creating || !name.trim() || !selectedProfileId}
                    className="rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create Channel"}
                  </button>
                  <button
                    onClick={() => router.push("/dashboard/channels")}
                    className="rounded-md border border-[#eaeaea] px-3 py-1.5 text-sm text-[#666]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
