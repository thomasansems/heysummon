"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Check, Zap } from "lucide-react";

interface StepTestE2eProps {
  apiKeyId: string;
  onSuccess: () => void;
  onStatusChange?: (status: E2eStatus) => void;
}

type E2eStatus =
  | "ready"
  | "sending"
  | "waiting_provider"
  | "waiting_response"
  | "complete"
  | "timeout";

export function StepTestE2e({ apiKeyId, onSuccess, onStatusChange }: StepTestE2eProps) {
  const [status, setStatusInternal] = useState<E2eStatus>("ready");

  const setStatus = useCallback((s: E2eStatus) => {
    setStatusInternal(s);
    onStatusChange?.(s);
  }, [onStatusChange]);
  const [elapsed, setElapsed] = useState(0);
  const [requestId, setRequestId] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const runTest = async () => {
    setStatus("sending");
    setElapsed(0);

    try {
      const res = await fetch("/api/v1/onboarding/test-e2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create test request");
      }

      const data = await res.json();
      setRequestId(data.requestId);
      setStatus("waiting_provider");

      // Start polling
      const startTime = Date.now();
      intervalRef.current = setInterval(async () => {
        const elapsedMs = Date.now() - startTime;
        setElapsed(Math.floor(elapsedMs / 1000));

        if (elapsedMs > 180_000) {
          stop();
          setStatus("timeout");
          return;
        }

        try {
          const pollRes = await fetch(
            `/api/v1/onboarding/test-e2e?requestId=${data.requestId}`
          );
          if (pollRes.ok) {
            const pollData = await pollRes.json();
            if (pollData.status === "active" || pollData.status === "responded") {
              setStatus("waiting_response");
            }
            if (pollData.responded) {
              stop();
              setStatus("complete");
            }
          }
        } catch {
          // Keep polling
        }
      }, 2000);
    } catch {
      setStatus("ready");
    }
  };

  useEffect(() => {
    if (status === "complete") {
      const timer = setTimeout(onSuccess, 2000);
      return () => clearTimeout(timer);
    }
  }, [status, onSuccess]);

  const statusSteps = [
    { key: "sending", label: "Creating test request..." },
    { key: "waiting_provider", label: "Sending to provider..." },
    { key: "waiting_response", label: "Waiting for provider response..." },
    { key: "complete", label: "Response received!" },
  ];

  return (
    <div>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        End-to-End Test
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        This tests the complete flow: client sends a question, provider receives it,
        responds, and the response is delivered back.
      </p>

      {status === "ready" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-foreground mb-2">Full round-trip test:</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
              <li>A test question is sent from the client</li>
              <li>Your provider receives a notification</li>
              <li>You respond from your provider channel</li>
              <li>We verify the response reaches the client</li>
            </ol>
          </div>
          <button
            onClick={runTest}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              Run End-to-End Test
            </span>
          </button>
        </div>
      )}

      {status !== "ready" && status !== "timeout" && (
        <div className="space-y-3">
          {statusSteps.map((s) => {
            const isActive =
              s.key === status ||
              (s.key === "waiting_provider" && status === "sending");
            const isDone =
              statusSteps.findIndex((x) => x.key === status) >
              statusSteps.findIndex((x) => x.key === s.key);

            return (
              <div
                key={s.key}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                  isDone
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                    : isActive
                      ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
                      : "border-border bg-muted/10"
                }`}
              >
                {isDone ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : isActive ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                ) : (
                  <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
                )}
                <span
                  className={`text-sm ${
                    isDone
                      ? "text-green-700 dark:text-green-400"
                      : isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}

          {(status === "waiting_provider" || status === "waiting_response") && (
            <p className="text-xs text-muted-foreground text-center">
              Check your provider channel and respond to the test message ({elapsed}s
              elapsed)
            </p>
          )}
        </div>
      )}

      {status === "timeout" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
              Test timed out
            </p>
            <p className="text-xs text-muted-foreground">
              The end-to-end test didn&apos;t complete within 3 minutes. This usually
              means the provider didn&apos;t respond in time.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={runTest}
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
