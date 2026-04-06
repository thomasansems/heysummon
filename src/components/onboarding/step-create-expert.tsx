"use client";

import { useState, useEffect, useCallback } from "react";
import { Users, Plus } from "lucide-react";
import {
  ChannelSelector,
  type ExpertChannelType,
} from "@/components/shared/channel-selector";

interface StepCreateExpertProps {
  onCreated: (data: {
    expertId: string;
    expertKey: string;
    expertName: string;
    channel: ExpertChannelType;
  }) => void;
}

export function StepCreateExpert({ onCreated }: StepCreateExpertProps) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<ExpertChannelType | null>(null);
  const [botToken, setBotToken] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [tunnelActive, setTunnelActive] = useState<boolean | null>(null);

  const fetchTunnelStatus = useCallback(() => {
    fetch("/api/admin/tunnel/status")
      .then((r) => r.json())
      .then((d) => setTunnelActive(d.active ?? false))
      .catch(() => setTunnelActive(false));
  }, []);

  useEffect(() => {
    if (channel === "telegram") fetchTunnelStatus();
  }, [channel, fetchTunnelStatus]);

  const handleCreate = async () => {
    if (!name.trim() || !channel) return;
    if (channel === "telegram" && !botToken.trim()) {
      setError("Bot token is required for Telegram");
      return;
    }
    setCreating(true);
    setError("");

    try {
      // Validate Telegram bot token before creating anything
      if (channel === "telegram") {
        const validateRes = await fetch("/api/validate/telegram-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ botToken: botToken.trim() }),
        });
        const validateData = await validateRes.json().catch(() => ({}));
        if (!validateRes.ok || !validateData.valid) {
          setError(validateData.error || "Invalid bot token — please check and try again");
          setCreating(false);
          return;
        }
      }

      const provRes = await fetch("/api/experts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!provRes.ok) {
        const data = await provRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create expert");
      }

      const provData = await provRes.json();
      const expertId: string = provData.expert?.id || provData.id;
      const expertKey: string = provData.expert?.key || provData.key;

      if (channel === "telegram") {
        const channelRes = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: expertId,
            type: "telegram",
            name: `${name.trim()} — Telegram`,
            config: { botToken: botToken.trim() },
          }),
        });
        if (!channelRes.ok) {
          const err = await channelRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to connect Telegram bot");
        }
      }

      onCreated({ expertId, expertKey, expertName: name.trim(), channel });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Users className="h-5 w-5 shrink-0" />
        Create Your Expert
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Choose how you want to receive help requests.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Expert name <span className="text-red-400">*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Thomas — Support"
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
          />
        </div>

        <ChannelSelector
          selected={channel}
          onSelect={setChannel}
          botToken={botToken}
          onBotTokenChange={setBotToken}
          tunnelActive={tunnelActive}
        />

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>

      <div className="mt-6 flex justify-end">
        <button
          onClick={handleCreate}
          disabled={
            creating ||
            !name.trim() ||
            !channel ||
            (channel === "telegram" && !botToken.trim())
          }
          className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            {!creating && <Plus className="h-4 w-4" />}
            {creating ? "Creating..." : "Create Expert"}
          </span>
        </button>
      </div>
    </div>
  );
}
