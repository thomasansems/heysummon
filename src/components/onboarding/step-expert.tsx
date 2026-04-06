"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, Check, Users, Plus, RefreshCw, SkipForward, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import {
  ChannelSelector,
  type ExpertChannelType,
} from "@/components/shared/channel-selector";
import { SuccessCelebration } from "@/components/onboarding/success-celebration";

type Phase = "form" | "creating" | "verifying" | "connected";

interface StepExpertProps {
  onComplete: (data: {
    expertId: string;
    expertKey: string;
    expertName: string;
    channel: ExpertChannelType;
  }) => void;
}

export function StepExpert({ onComplete }: StepExpertProps) {
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<ExpertChannelType | null>(null);
  const [botToken, setBotToken] = useState("");
  const [error, setError] = useState("");
  const [tunnelActive, setTunnelActive] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);

  // Created expert data
  const [expertId, setExpertId] = useState("");
  const [expertKey, setExpertKey] = useState("");
  const [expertChannel, setExpertChannel] = useState<ExpertChannelType | null>(null);
  const [telegramDeepLink, setTelegramDeepLink] = useState("");

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
    if (channel === "telegram" || channel === "slack") fetchTunnelStatus();
  }, [channel, fetchTunnelStatus]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startVerification = useCallback(
    (pid: string, ch: ExpertChannelType) => {
      stopPolling();
      setPhase("verifying");
      setVerifyStatus("checking");
      setElapsed(0);
      const startTime = Date.now();

      intervalRef.current = setInterval(async () => {
        const elapsedMs = Date.now() - startTime;
        setElapsed(Math.floor(elapsedMs / 1000));

        if (elapsedMs > 600_000) {
          stopPolling();
          setVerifyStatus("timeout");
          return;
        }

        try {
          const res = await fetch("/api/experts");
          if (!res.ok) return;
          const json = await res.json();
          const data = (json.experts || []).find((e: { id: string }) => e.id === pid);
          if (!data) return;

          if (ch === "telegram") {
            const telegramCh = data.expertChannels?.find(
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
    if (verifyStatus === "connected" && expertId && expertKey && expertChannel) {
      const timer = setTimeout(() => {
        setPhase("connected");
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [verifyStatus, expertId, expertKey, expertChannel]);

  const handleCreate = async () => {
    if (!name.trim() || !channel) return;
    if (channel === "telegram" && !botToken.trim()) {
      setError("Bot token is required for Telegram");
      return;
    }
    setPhase("creating");
    setError("");

    try {
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
      const pid: string = provData.expert?.id || provData.id;
      const pkey: string = provData.expert?.key || provData.key;

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

        // Extract bot username and setup token for the deep link
        try {
          const chData = await channelRes.json();
          const chConfig = JSON.parse(chData.channel?.config || "{}");
          if (chConfig.botUsername && chConfig.setupToken) {
            setTelegramDeepLink(
              `https://t.me/${chConfig.botUsername}?start=${chConfig.setupToken}`
            );
          }
        } catch {
          // Non-fatal — verification can still proceed
        }
      }

      setExpertId(pid);
      setExpertKey(pkey);
      setExpertChannel(channel);

      // Start verification immediately
      startVerification(pid, channel);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("form");
    }
  };

  const handleCopy = () => {
    copyToClipboard(expertKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Users className="h-5 w-5 shrink-0" />
        Set Up Your Expert
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Create an expert profile and choose how to receive notifications.
      </p>

      {/* Phase: Form */}
      {phase === "form" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="mt-5 mb-1.5 block text-xs font-medium text-muted-foreground">
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
              <span className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" />
                Create & Connect
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Phase: Creating */}
      {phase === "creating" && (
        <div className="flex flex-col items-center gap-3 py-8 animate-in fade-in duration-200">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Creating expert...</p>
        </div>
      )}

      {/* Phase: Connected — success celebration */}
      {phase === "connected" && (
        <SuccessCelebration
          label="Expert connected!"
          sublabel="Your expert is ready to receive help requests."
          onContinue={() =>
            onComplete({
              expertId,
              expertKey,
              expertName: name.trim(),
              channel: expertChannel!,
            })
          }
        />
      )}

      {/* Phase: Verifying */}
      {phase === "verifying" && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Show instructions based on channel */}
          {expertChannel === "telegram" ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              {telegramDeepLink ? (
                <>
                  <p className="text-sm text-foreground mb-2">
                    Connect your Telegram bot:
                  </p>
                  <a
                    href={telegramDeepLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
                  >
                    Open in Telegram
                  </a>
                  <p className="text-xs text-muted-foreground mt-2">
                    Sends /start to link your chat.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground mb-2">
                    Open your Telegram bot and send{" "}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-xs">
                      /start
                    </code>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activates your bot to receive help requests.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-black p-4 space-y-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground font-medium">
                  1. Install the skill
                </p>
                <code className="text-xs text-green-400">
                  /skill install https://clawhub.ai/thomasansems/heysummon-expert
                </code>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground font-medium">
                  2. Your expert key
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-green-400 break-all">
                    {expertKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  >
                    {copied ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
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
                    {expertChannel === "telegram"
                      ? "Send /start in Telegram"
                      : "Complete the steps above"}
                  </p>
                </div>
              </>
            )}
            {verifyStatus === "timeout" && (
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

          {verifyStatus === "timeout" && (
            <div className="flex gap-2">
              <button
                onClick={() => startVerification(expertId, expertChannel!)}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </span>
              </button>
              <button
                onClick={() =>
                  onComplete({
                    expertId,
                    expertKey,
                    expertName: name.trim(),
                    channel: expertChannel!,
                  })
                }
                className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              >
                <span className="flex items-center gap-1.5">
                  <SkipForward className="h-3.5 w-3.5" />
                  Skip verification
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
