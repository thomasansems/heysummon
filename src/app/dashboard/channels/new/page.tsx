"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  name: string;
}

type ChannelType = "openclaw" | "telegram" | "slack" | null;

const channelTypes = [
  {
    type: "openclaw" as const,
    label: "OpenClaw",
    icon: "/icons/openclaw.svg",
    description: "Connect an OpenClaw AI agent to receive help requests",
  },
  {
    type: "telegram" as const,
    label: "Telegram",
    icon: "/icons/telegram.svg",
    description: "Receive help requests via a Telegram bot",
  },
  {
    type: "slack" as const,
    label: "Slack",
    icon: "/icons/slack.svg",
    description: "Receive help requests in a Slack channel",
  },
  {
    type: null,
    label: "WhatsApp",
    icon: "/icons/whatsapp.svg",
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
  const [botToken, setBotToken] = useState("");
  const [slackBotToken, setSlackBotToken] = useState("");
  const [slackSigningSecret, setSlackSigningSecret] = useState("");
  const [slackChannelId, setSlackChannelId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/experts")
      .then((r) => r.json())
      .then((data) => {
        const list = data.experts || [];
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
    if (selectedType === "telegram") {
      if (!botToken.trim()) {
        setError("Bot token is required");
        setCreating(false);
        return;
      }
      config.botToken = botToken.trim();
    }
    if (selectedType === "slack") {
      if (!slackBotToken.trim()) {
        setError("Bot token is required");
        setCreating(false);
        return;
      }
      if (!slackSigningSecret.trim()) {
        setError("Signing secret is required");
        setCreating(false);
        return;
      }
      if (!slackChannelId.trim()) {
        setError("Channel ID is required");
        setCreating(false);
        return;
      }
      config.botToken = slackBotToken.trim();
      config.signingSecret = slackSigningSecret.trim();
      config.channelId = slackChannelId.trim();
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
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {step === 2 ? "← Back" : "← Channels"}
        </button>
        <h1 className="text-2xl font-semibold text-foreground">New Channel</h1>
      </div>

      {step === 1 && (
        <div>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose the type of channel you want to connect.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {channelTypes.map((ct) => (
              <button
                key={ct.label}
                onClick={() => handleTypeSelect(ct.type)}
                disabled={ct.disabled}
                className={`rounded-lg border border-border bg-card p-5 text-left transition-colors ${
                  ct.disabled
                    ? "cursor-not-allowed opacity-50"
                    : "hover:border-black"
                }`}
              >
                <div className="mb-2 flex items-center gap-2">
                  <img src={ct.icon} alt={ct.label} className="h-8 w-8 rounded" />
                  <span className="text-sm font-medium text-foreground">{ct.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{ct.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && selectedType === "openclaw" && (
        <div className="max-w-md space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <img src="/icons/openclaw.svg" alt="OpenClaw" className="h-8 w-8 rounded" />
              <h2 className="text-sm font-medium text-foreground">OpenClaw Setup</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              OpenClaw channels are configured through the OpenClaw agent itself — no manual setup needed here.
              Follow the guide to connect your OpenClaw agent to HeySummon.
            </p>
            <a
              href="https://docs.heysummon.ai/guides/openclaw"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-black/90"
            >
              View Setup Guide →
            </a>
          </div>
        </div>
      )}

      {step === 2 && selectedType && selectedType !== "openclaw" && (
        <div className="max-w-md space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-medium text-foreground">
              Configure {selectedType === "telegram" ? "Telegram" : selectedType === "slack" ? "Slack" : selectedType} Channel
            </h2>

            {profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No user profiles yet.{" "}
                <a href="/dashboard/experts" className="text-orange-600 hover:text-orange-800">
                  Create one
                </a>{" "}
                first.
              </p>
            ) : (
              <div className="space-y-3">
                {profiles.length > 1 && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Profile
                    </label>
                    <select
                      value={selectedProfileId}
                      onChange={(e) => setSelectedProfileId(e.target.value)}
                      className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                    >
                      <option value="">Select profile...</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Channel Name
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Support Bot"
                    className="w-full rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                </div>

                {selectedType === "telegram" && (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      Bot Token
                    </label>
                    <input
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456789:ABCdef..."
                      className="w-full rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Get a bot token from{" "}
                      <a
                        href="https://t.me/BotFather"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-orange-600 hover:text-orange-800"
                      >
                        @BotFather
                      </a>{" "}
                      on Telegram.
                    </p>
                  </div>
                )}

                {selectedType === "slack" && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Bot Token
                      </label>
                      <input
                        value={slackBotToken}
                        onChange={(e) => setSlackBotToken(e.target.value)}
                        placeholder="xoxb-..."
                        className="w-full rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Found under OAuth &amp; Permissions in your{" "}
                        <a
                          href="https://api.slack.com/apps"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-600 hover:text-orange-800"
                        >
                          Slack app settings
                        </a>.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Signing Secret
                      </label>
                      <input
                        value={slackSigningSecret}
                        onChange={(e) => setSlackSigningSecret(e.target.value)}
                        placeholder="abc123..."
                        className="w-full rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Found under Basic Information &gt; App Credentials in your Slack app.
                      </p>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Channel ID
                      </label>
                      <input
                        value={slackChannelId}
                        onChange={(e) => setSlackChannelId(e.target.value)}
                        placeholder="C0123456789"
                        className="w-full rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm text-foreground outline-none focus:border-ring"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Right-click a channel in Slack, select &quot;View channel details&quot;, then copy the Channel ID at the bottom.
                      </p>
                    </div>
                  </>
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
                    className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground"
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
