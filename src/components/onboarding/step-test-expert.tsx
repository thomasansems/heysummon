"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Check, MessageSquare, RefreshCw, SkipForward } from "lucide-react";
import type { ExpertChannelType } from "@/components/shared/channel-selector";
import { SuccessCelebration } from "@/components/onboarding/success-celebration";

interface StepTestExpertProps {
  expertId: string;
  channel: ExpertChannelType;
  onSuccess: () => void;
}

type TestStatus = "idle" | "sending" | "waiting" | "received" | "timeout";

export function StepTestExpert({
  expertId,
  channel,
  onSuccess,
}: StepTestExpertProps) {
  const [status, setStatus] = useState<TestStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [testId, setTestId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const sendTest = async () => {
    setStatus("sending");
    setElapsed(0);
    try {
      const res = await fetch("/api/v1/onboarding/test-expert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expertId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to send test");
      }
      const data = await res.json();
      setTestId(data.testId);
      setStatus("waiting");

      // Start polling for response
      const startTime = Date.now();
      intervalRef.current = setInterval(async () => {
        const elapsedMs = Date.now() - startTime;
        setElapsed(Math.floor(elapsedMs / 1000));

        if (elapsedMs > 600_000) {
          stop();
          setStatus("timeout");
          return;
        }

        try {
          const pollRes = await fetch(
            `/api/v1/onboarding/test-expert?testId=${data.testId}&expertId=${expertId}`
          );
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.responded) {
              stop();
              setStatus("received");
            }
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch {
      setStatus("idle");
    }
  };

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <MessageSquare className="h-5 w-5 shrink-0" />
        Test Expert
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Verify your expert receives and can respond to notifications.
      </p>

      {status === "idle" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              We&apos;ll send a test notification to your{" "}
              {channel === "telegram" ? "Telegram bot" : "OpenClaw agent"}.
              Reply to it and we&apos;ll confirm it worked.
            </p>
          </div>
          <button
            onClick={sendTest}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Send Test Message
            </span>
          </button>
        </div>
      )}

      {status === "sending" && (
        <div className="flex items-center gap-3 py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Sending test message...</p>
        </div>
      )}

      {status === "waiting" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">
                Waiting for your response... ({elapsed}s)
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {channel === "telegram"
                  ? "Reply to the test message in Telegram"
                  : "Respond in your OpenClaw agent"}
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "received" && (
        <SuccessCelebration
          label="Test passed! Response received."
          sublabel="Your expert is working correctly."
          onContinue={onSuccess}
        />
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
              No response received
            </p>
            <p className="text-xs text-muted-foreground">
              Timed out. Check that your expert channel is active and try again.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={sendTest}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </span>
            </button>
            <button
              onClick={onSuccess}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-1.5">
                <SkipForward className="h-3.5 w-3.5" />
                Skip test
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
