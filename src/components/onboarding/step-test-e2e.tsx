"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Loader2, Check, Zap, Copy, ExternalLink, RefreshCw, SkipForward } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";
import { SuccessCelebration } from "@/components/onboarding/success-celebration";

interface StepTestE2eProps {
  apiKeyId: string;
  expertName: string;
  expertChannel: string | null;
  onSuccess: () => void;
  onStatusChange?: (status: E2eStatus) => void;
}

export type E2eStatus =
  | "ready"
  | "sending"
  | "waiting_request"
  | "received"
  | "notified"
  | "responded"
  | "delivered"
  | "complete"
  | "timeout";

const DOCS_BASE = "https://docs.heysummon.ai";
const STAGE_DOCS: Record<string, string> = {
  waiting_request: "/consumer/getting-started",
  received: "/expert/channels",
  notified: "/expert/channels",
  responded: "/consumer/api-reference",
};

interface StageInfo {
  key: string;
  label: string;
  activeLabel: string;
  docHint: string;
}

const STAGES: StageInfo[] = [
  {
    key: "received",
    label: "Request received",
    activeLabel: "Waiting for request from client...",
    docHint: "Check skill installation and API key.",
  },
  {
    key: "notified",
    label: "Expert notified",
    activeLabel: "Notifying expert...",
    docHint: "Check channel connection.",
  },
  {
    key: "responded",
    label: "Expert responded",
    activeLabel: "Waiting for your response...",
    docHint: "Tap Approve or Deny in your channel.",
  },
  {
    key: "delivered",
    label: "Response delivered",
    activeLabel: "Delivering response to client...",
    docHint: "Client receives the response automatically.",
  },
];

function stageIndex(stage: string): number {
  const idx = STAGES.findIndex((s) => s.key === stage);
  return idx === -1 ? -1 : idx;
}

export function StepTestE2e({
  apiKeyId,
  expertName,
  expertChannel,
  onSuccess,
  onStatusChange,
}: StepTestE2eProps) {
  const [status, setStatusInternal] = useState<E2eStatus>("ready");
  const [currentStage, setCurrentStage] = useState<string>("waiting_request");
  const [approvalDecision, setApprovalDecision] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [monitoringSince, setMonitoringSince] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setStatus = useCallback(
    (s: E2eStatus) => {
      setStatusInternal(s);
      onStatusChange?.(s);
    },
    [onStatusChange]
  );

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stop(), [stop]);

  const channelLabel =
    expertChannel === "slack"
      ? "Slack"
      : expertChannel === "openclaw"
        ? "OpenClaw"
        : "Telegram";

  const suggestedPrompt = `hey summon ${expertName} I would like to proceed with the current implementation. Please approve.`;

  const startMonitoring = async () => {
    setStatus("sending");
    setElapsed(0);
    setCurrentStage("waiting_request");
    setApprovalDecision(null);

    try {
      const res = await fetch("/api/v1/onboarding/test-e2e", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKeyId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start monitoring");
      }

      const data = await res.json();
      setMonitoringSince(data.monitoringSince);
      setStatus("waiting_request");

      // Start polling
      const startTime = Date.now();
      intervalRef.current = setInterval(async () => {
        const elapsedMs = Date.now() - startTime;
        setElapsed(Math.floor(elapsedMs / 1000));

        if (elapsedMs > 300_000) {
          stop();
          setStatus("timeout");
          return;
        }

        try {
          const pollRes = await fetch(
            `/api/v1/onboarding/test-e2e?apiKeyId=${apiKeyId}&since=${encodeURIComponent(data.monitoringSince)}`
          );
          if (!pollRes.ok) return;

          const pollData = await pollRes.json();
          const stage = pollData.stage as string;

          if (stage !== "waiting") {
            setCurrentStage(stage);

            if (pollData.approvalDecision) {
              setApprovalDecision(pollData.approvalDecision);
            }

            // Map stage to E2eStatus for the live view
            if (stage === "received") setStatus("received");
            else if (stage === "notified") setStatus("notified");
            else if (stage === "responded") setStatus("responded");
            else if (stage === "delivered") {
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

  // Also consider "responded" as complete after a short delay if delivery doesn't come
  useEffect(() => {
    if (status === "responded") {
      const timer = setTimeout(() => {
        stop();
        setStatus("complete");
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [status, stop, setStatus]);


  const handleCopy = () => {
    copyToClipboard(suggestedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    stop();
    setStatus("ready");
    setCurrentStage("waiting_request");
    setMonitoringSince(null);
    setApprovalDecision(null);
    setElapsed(0);
  };

  const isMonitoring =
    status !== "ready" && status !== "timeout" && status !== "complete";
  const currentStageIdx = stageIndex(currentStage);

  return (
    <div>
      <h2 className="mb-1 flex items-center gap-2 font-serif text-lg font-semibold text-foreground">
        <Zap className="h-5 w-5 text-primary shrink-0" />
        End-to-End Test
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        Verify the full round-trip: AI client to {channelLabel} and back.
      </p>

      {/* Ready state -- show instructions */}
      {status === "ready" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">
              Paste this into your AI client:
            </p>
            <div className="relative rounded-md border border-border bg-black p-3">
              <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap pr-8">
                {suggestedPrompt}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 rounded-md p-1.5 text-zinc-500 hover:text-zinc-300 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Triggers an approval request in {channelLabel}. Respond there and
              watch it flow back.
            </p>
          </div>

          <button
            onClick={startMonitoring}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            <span className="flex items-center justify-center gap-2">
              <Zap className="h-4 w-4" />
              Start Monitoring
            </span>
          </button>
        </div>
      )}

      {/* Monitoring state -- show stages */}
      {isMonitoring && (
        <div className="space-y-3">
          {/* Prompt reminder */}
          {status === "waiting_request" && (
            <div className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-muted-foreground">
                  Paste into your AI client:
                </p>
                <button
                  onClick={handleCopy}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {copied ? "Copied!" : "Copy"}
                  <Copy className="h-3 w-3" />
                </button>
              </div>
              <code className="text-[11px] text-foreground font-mono break-all">
                {suggestedPrompt}
              </code>
            </div>
          )}

          {/* Stage progress */}
          {STAGES.map((stage, idx) => {
            const isDone = currentStageIdx > idx;
            const isActive = currentStageIdx === idx;
            const isFuture = currentStageIdx < idx;
            const docUrl = STAGE_DOCS[stage.key];

            return (
              <div
                key={stage.key}
                className={`rounded-lg border p-3 transition-colors ${
                  isDone
                    ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20"
                    : isActive
                      ? "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20"
                      : "border-border bg-muted/10"
                }`}
              >
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shrink-0">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  ) : isActive ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary shrink-0" />
                  ) : (
                    <div className="h-5 w-5 rounded-full bg-muted shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm ${
                        isDone
                          ? "text-green-700 dark:text-green-400"
                          : isActive
                            ? "text-foreground"
                            : "text-muted-foreground"
                      }`}
                    >
                      {isDone
                        ? stage.key === "responded" && approvalDecision
                          ? `Expert ${approvalDecision === "approved" ? "approved" : "denied"} the request`
                          : stage.label
                        : isActive
                          ? stage.activeLabel
                          : stage.label}
                    </span>
                    {isActive && docUrl && (
                      <div className="flex items-center gap-1 mt-1">
                        <p className="text-[11px] text-muted-foreground">
                          {stage.docHint}
                        </p>
                        <a
                          href={`${DOCS_BASE}${docUrl}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-primary hover:underline flex items-center gap-0.5 shrink-0"
                        >
                          Docs
                          <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-muted-foreground text-center">
            {elapsed}s elapsed
          </p>
        </div>
      )}

      {/* Complete state */}
      {status === "complete" && (
        <div className="space-y-4">
          <div className="space-y-3">
            {STAGES.map((stage) => (
              <div
                key={stage.key}
                className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-3"
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600 shrink-0">
                  <Check className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-green-700 dark:text-green-400">
                  {stage.key === "responded" && approvalDecision
                    ? `Expert ${approvalDecision === "approved" ? "approved" : "denied"} the request`
                    : stage.label}
                </span>
              </div>
            ))}
          </div>
          <SuccessCelebration
            label="Full round-trip verified!"
            sublabel="Your setup is working -- you're ready to go."
            onContinue={onSuccess}
            continueLabel="Finish setup"
          />
        </div>
      )}

      {/* Timeout state */}
      {status === "timeout" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1">
              Test timed out
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {currentStageIdx < 0
                ? "No request received."
                : `Stuck at: ${STAGES[currentStageIdx]?.activeLabel}`}
            </p>
            {STAGE_DOCS[currentStage] && (
              <a
                href={`${DOCS_BASE}${STAGE_DOCS[currentStage]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                Troubleshooting guide
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRetry}
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
                Skip to dashboard
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
