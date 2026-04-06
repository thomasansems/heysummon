"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Building2, ArrowRight, ArrowLeft, Plus, Settings } from "lucide-react";
import {
  ClientChannelSelector,
  type ClientChannelType,
  type ClientSubChannelType,
} from "@/components/shared/client-channel-selector";

const DEFAULT_TIMEOUT = 900;
const DEFAULT_POLL_INTERVAL = 3;

interface StepCreateClientProps {
  expertId: string;
  expertName: string;
  onCreated: (data: {
    keyId: string;
    apiKey: string;
    setupUrl: string;
    channel: ClientChannelType;
    subChannel: ClientSubChannelType | null;
    clientName: string;
    timeout: number;
    pollInterval: number;
  }) => void;
}

export function StepCreateClient({
  expertId,
  expertName,
  onCreated,
}: StepCreateClientProps) {
  const [channel, setChannel] = useState<ClientChannelType | null>(null);
  const [subChannel, setSubChannel] = useState<ClientSubChannelType | null>(null);
  const [name, setName] = useState("");
  const [timeout, setTimeout_] = useState(DEFAULT_TIMEOUT);
  const [pollInterval, setPollInterval] = useState(DEFAULT_POLL_INTERVAL);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"channel" | "details">("channel");

  const handleCreate = async () => {
    if (!channel) return;
    setCreating(true);
    setError(null);

    try {
      // Create the API key
      const keyRes = await fetch("/api/v1/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name || undefined,
          expertId,
          scope: "full",
          rateLimitPerMinute: 150,
          clientChannel: channel,
          clientSubChannel: subChannel ?? undefined,
        }),
      });

      if (!keyRes.ok) {
        const errData = await keyRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create client");
      }

      const keyData = await keyRes.json();
      const keyId: string = keyData.key?.id ?? keyData.id;
      const apiKey: string = keyData.key?.key ?? keyData.key;

      // Generate setup link
      const linkRes = await fetch("/api/v1/setup-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyId,
          channel,
          subChannel,
        }),
      });

      let setupUrl = "";
      if (linkRes.ok) {
        const linkData = await linkRes.json();
        setupUrl = linkData.setupUrl;
      }

      onCreated({ keyId, apiKey, setupUrl, channel, subChannel, clientName: name, timeout, pollInterval });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Building2 className="h-5 w-5 shrink-0" />
        Create a Client
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Choose which AI platform to connect to your expert.
      </p>

      {step === "channel" && (
        <>
          <ClientChannelSelector
            selected={channel}
            subChannel={subChannel}
            onSelect={(ch) => {
              setChannel(ch);
              setSubChannel(null);
            }}
            onSubChannelSelect={setSubChannel}
          />

          <div className="flex justify-end">
            <button
              onClick={() => setStep("details")}
              disabled={!channel || (channel === "openclaw" && !subChannel)}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                Next
                <ArrowRight className="h-4 w-4" />
              </span>
            </button>
          </div>
        </>
      )}

      {step === "details" && (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Client name (optional)
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Claude Code Assistant"
              className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Expert
            </label>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
              <span className="text-sm text-foreground">{expertName}</span>
              <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                Connected
              </span>
            </div>
          </div>

          {/* Advanced settings toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showAdvanced ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              <Settings className="h-3.5 w-3.5" />
              Advanced settings
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3 rounded-md border border-border bg-muted/20 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Request timeout (seconds)
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={3600}
                    value={timeout}
                    onChange={(e) => setTimeout_(Number(e.target.value) || DEFAULT_TIMEOUT)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Max wait time for an expert response.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Poll interval (seconds)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={pollInterval}
                    onChange={(e) => setPollInterval(Number(e.target.value) || DEFAULT_POLL_INTERVAL)}
                    className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Lower = faster delivery, more API calls.
                  </p>
                </div>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-between">
            <button
              onClick={() => setStep("channel")}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </span>
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="rounded-md bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-40 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                {!creating && <Plus className="h-4 w-4" />}
                {creating ? "Creating..." : "Create Client"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
