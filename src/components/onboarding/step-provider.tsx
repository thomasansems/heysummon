"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Check } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  ChannelSelector,
  type ProviderChannelType,
} from "@/components/shared/channel-selector";

type Phase = "form" | "creating" | "verifying" | "connected";

interface StepProviderProps {
  onComplete: (data: {
    providerId: string;
    providerKey: string;
    providerName: string;
    channel: ProviderChannelType;
  }) => void;
}

export function StepProvider({ onComplete }: StepProviderProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<ProviderChannelType | null>(null);
  const [botToken, setBotToken] = useState("");
  const [error, setError] = useState("");
  const [tunnelActive, setTunnelActive] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // Created provider data
  const [providerId, setProviderId] = useState("");
  const [providerKey, setProviderKey] = useState("");
  const [providerChannel, setProviderChannel] = useState<ProviderChannelType | null>(null);

  // Verify polling
  const [elapsed, setElapsed] = useState(0);
  const [verifyStatus, setVerifyStatus] = useState<"checking" | "connected" | "timeout">("checking");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTunnelStatus = useCallback(() => {
    fetch("/api/admin/tunnel/status")
      .then((r) => r.json())
      .then((d) => setTunnelActive(d.active ?? false))
      .catch(() => setTunnelActive(false));
  }, []);

  useEffect(() => {
    if (channel === "telegram") fetchTunnelStatus();
  }, [channel, fetchTunnelStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startVerification = useCallback(
    (pid: string, ch: ProviderChannelType) => {
      stopPolling();
      setPhase("verifying");
      setVerifyStatus("checking");
      setElapsed(0);
      const startTime = Date.now();

      intervalRef.current = setInterval(async () => {
        const elapsedMs = Date.now() - startTime;
        setElapsed(Math.floor(elapsedMs / 1000));

        if (elapsedMs > 120_000) {
          stopPolling();
          setVerifyStatus("timeout");
          return;
        }

        try {
          const res = await fetch(`/api/providers/${pid}`);
          if (!res.ok) return;
          const data = await res.json();

          if (ch === "telegram") {
            const telegramCh = data.channelProviders?.find(
              (c: { type: string; status: string }) => c.type === "telegram"
            );
            if (telegramCh?.status === "connected") {
              stopPolling();
              setVerifyStatus("connected");
            }
          } else {
            const hasBound = data.ipEvents?.some(
              (e: { status: string }) => e.status === "allowed"
            );
            if (hasBound) {
              stopPolling();
              setVerifyStatus("connected");
            }
          }
        } catch {
          // keep polling
        }
      }, 3000);
    },
    [stopPolling]
  );

  useEffect(() => {
    if (verifyStatus === "connected" && providerId && providerKey && providerChannel) {
      const timer = setTimeout(() => {
        setPhase("connected");
        setTimeout(() => {
          onComplete({
            providerId,
            providerKey,
            providerName: name.trim(),
            channel: providerChannel,
          });
        }, 1000);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [verifyStatus, providerId, providerKey, providerChannel, name, onComplete]);

  const handleCreate = async () => {
    if (!name.trim() || !channel) return;
    if (channel === "telegram" && !botToken.trim()) {
      setError("Bot token is required for Telegram");
      return;
    }
    setPhase("creating");
    setError("");

    try {
      const provRes = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!provRes.ok) {
        const data = await provRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create provider");
      }

      const provData = await provRes.json();
      const pid: string = provData.provider?.id || provData.id;
      const pkey: string = provData.provider?.key || provData.key;

      if (channel === "telegram") {
        const channelRes = await fetch("/api/channels", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId: pid,
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

      setProviderId(pid);
      setProviderKey(pkey);
      setProviderChannel(channel);

      // Start verification immediately
      startVerification(pid, channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("form");
    }
  };

  const handleCopy = () => {
    copyToClipboard(providerKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Set Up Your Provider
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Create a provider and connect it to start receiving help requests.
      </p>

      {/* Phase: Form */}
      {phase === "form" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Provider name <span className="text-red-400">*</span>
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

          <div className="flex justify-end">
            <button
              onClick={handleCreate}
              disabled={
                !name.trim() ||
                !channel ||
                (channel === "telegram" && !botToken.trim())
              }
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-40 transition-colors"
            >
              Create & Connect
            </button>
          </div>
        </div>
      )}

      {/* Phase: Creating */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-3 py-8 animate-in fade-in duration-200">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Creating provider...</p>
        </div>
      )}

      {/* Phase: Verifying */}
      {(phase === "verifying" || phase === "connected") && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Show instructions based on channel */}
          {providerChannel === "telegram" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm text-foreground mb-2">
                Open your Telegram bot and send{" "}
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-xs">
                  /start
                </code>
              </p>
              <p className="text-xs text-muted-foreground">
                This activates the bot so it can receive help requests.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-black p-4 space-y-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground font-medium">
                  1. Install the skill
                </p>
                <code className="text-xs text-green-400">
                  /skill install https://clawhub.ai/thomasansems/heysummon-provider
                </code>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground font-medium">
                  2. Your provider key
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-green-400 break-all">
                    {providerKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 text-xs text-primary hover:text-primary/80"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Connection status */}
          <div className="flex items-center gap-3 rounded-lg border border-border p-4">
            {verifyStatus === "checking" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                <div>
                  <p className="text-sm text-foreground">
                    Waiting for connection... ({elapsed}s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {providerChannel === "telegram"
                      ? "Send /start to your bot on Telegram"
                      : "Complete the steps above"}
                  </p>
                </div>
              </>
            )}
            {(verifyStatus === "connected" || phase === "connected") && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0 animate-in zoom-in duration-300">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Provider connected!
                </p>
              </>
            )}
            {verifyStatus === "timeout" && phase !== "connected" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
                  <span className="text-white text-sm">!</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Connection timed out
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check the setup and try again
                  </p>
                </div>
              </>
            )}
          </div>

          {verifyStatus === "timeout" && phase !== "connected" && (
            <div className="flex gap-2">
              <button
                onClick={() => startVerification(providerId, providerChannel!)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                Retry
              </button>
              <button
                onClick={() =>
                  onComplete({
                    providerId,
                    providerKey,
                    providerName: name.trim(),
                    channel: providerChannel!,
                  })
                }
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Skip verification
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
