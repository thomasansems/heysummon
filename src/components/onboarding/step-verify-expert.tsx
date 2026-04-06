"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Check, Users, Copy, RefreshCw, SkipForward } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import type { ExpertChannelType } from "@/components/shared/channel-selector";

interface StepVerifyExpertProps {
  expertId: string;
  expertKey: string;
  channel: ExpertChannelType;
  onVerified: () => void;
}

export function StepVerifyExpert({
  expertId,
  expertKey,
  channel,
  onVerified,
}: StepVerifyExpertProps) {
  const [status, setStatus] = useState<"checking" | "connected" | "timeout">("checking");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stop();
    setStatus("checking");
    setElapsed(0);
    const startTime = Date.now();

    intervalRef.current = setInterval(async () => {
      const elapsedMs = Date.now() - startTime;
      setElapsed(Math.floor(elapsedMs / 1000));

      if (elapsedMs > 120_000) {
        stop();
        setStatus("timeout");
        return;
      }

      try {
        // For Telegram: check channel status. For OpenClaw: check IP events.
        const res = await fetch("/api/experts");
        if (!res.ok) return;
        const json = await res.json();
        const data = (json.experts || []).find((e: { id: string }) => e.id === expertId);
        if (!data) return;

        if (channel === "telegram") {
          const telegramCh = data.expertChannels?.find(
            (c: { type: string; status: string }) => c.type === "telegram"
          );
          if (telegramCh?.status === "connected") {
            stop();
            setStatus("connected");
          }
        } else {
          // OpenClaw: check if any IP event is allowed
          const hasBound = data.ipEvents?.some(
            (e: { status: string }) => e.status === "allowed"
          );
          if (hasBound) {
            stop();
            setStatus("connected");
          }
        }
      } catch {
        // Keep polling
      }
    }, 3000);
  }, [expertId, channel, stop]);

  useEffect(() => {
    startPolling();
    return stop;
  }, [startPolling, stop]);

  useEffect(() => {
    if (status === "connected") {
      const timer = setTimeout(onVerified, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onVerified]);

  const handleCopy = () => {
    copyToClipboard(expertKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Users className="h-5 w-5 text-primary shrink-0" />
        Connect Your Expert
      </h2>

      {channel === "telegram" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Send{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-foreground font-mono text-xs">
              /start
            </code>{" "}
            to your Telegram bot.
          </p>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
            {status === "checking" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">
                    Waiting for /start... ({elapsed}s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Send /start to your bot on Telegram
                  </p>
                </div>
              </>
            )}
            {status === "connected" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Telegram bot connected!
                  </p>
                </div>
              </>
            )}
            {status === "timeout" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
                  <span className="text-white text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Connection timed out
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check you sent /start to the right bot
                  </p>
                </div>
              </>
            )}
          </div>

          {status === "timeout" && (
            <button
              onClick={startPolling}
              className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Install the expert skill and configure your key.
          </p>

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
                  className="shrink-0 text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                >
                  {copied ? "Copied!" : <><Copy className="h-3 w-3" /> Copy</>}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4">
            {status === "checking" && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-orange-500 shrink-0" />
                <div>
                  <p className="text-sm text-foreground">
                    Waiting for connection... ({elapsed}s)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Complete the steps above to connect
                  </p>
                </div>
              </>
            )}
            {status === "connected" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0">
                  <Check className="h-4 w-4 text-white" />
                </div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  Expert connected!
                </p>
              </>
            )}
            {status === "timeout" && (
              <>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-600 shrink-0">
                  <span className="text-white text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Connection timed out
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Check installation and try again
                  </p>
                </div>
              </>
            )}
          </div>

          {status === "timeout" && (
            <div className="flex gap-2">
              <button
                onClick={startPolling}
                className="rounded-md bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-500"
              >
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </span>
              </button>
              <button
                onClick={onVerified}
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
