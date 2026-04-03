"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Check, MessageSquare } from "lucide-react";
import type { ExpertChannelType } from "@/components/shared/channel-selector";

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

        if (elapsedMs > 120_000) {
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

  useEffect(() => {
    if (status === "received") {
      const timer = setTimeout(onSuccess, 1500);
      return () => clearTimeout(timer);
    }
  }, [status, onSuccess]);

  return (
    <div>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Test Expert
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Send a test message to verify your expert receives notifications and can
        respond.
      </p>

      {status === "idle" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-foreground mb-2">What will happen:</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
              <li>
                A test message will be sent to your{" "}
                {channel === "telegram" ? "Telegram bot" : "OpenClaw agent"}
              </li>
              <li>You respond to it from {channel === "telegram" ? "Telegram" : "your agent"}</li>
              <li>We verify the response was received</li>
            </ol>
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
                  ? "Check your Telegram bot — reply to the test message"
                  : "Check your OpenClaw agent — respond to the test notification"}
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "received" && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0">
            <Check className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              Test passed! Response received.
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your expert is working correctly.
            </p>
          </div>
        </div>
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
              No response received
            </p>
            <p className="text-xs text-muted-foreground">
              The test timed out after 120 seconds. Make sure your expert channel is
              active and try again.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={sendTest}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
            >
              Try again
            </button>
            <button
              onClick={onSuccess}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Skip test
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
