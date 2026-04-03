"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ArrowRight, Copy } from "lucide-react";
import { copyToClipboard } from "@/lib/clipboard";

interface StepFirstRequestProps {
  clientChannel: string | null;
  onNext: () => void;
}

const PROMPT_TIP = `When you're unsure about a requirement, architecture decision,
or need human judgment — use the HeySummon skill to ask your
expert instead of guessing.

Example: "I need to implement auth but the spec is ambiguous.
Let me ask the human expert via HeySummon."`;

export function StepFirstRequest({
  clientChannel,
  onNext,
}: StepFirstRequestProps) {
  const [polling, setPolling] = useState(false);
  const [found, setFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const startPolling = useCallback(() => {
    setPolling(true);
    const startTime = Date.now();

    intervalRef.current = setInterval(async () => {
      // Stop after 5 minutes
      if (Date.now() - startTime > 300_000) {
        stopPolling();
        setPolling(false);
        return;
      }

      try {
        const res = await fetch("/api/v1/requests");
        if (!res.ok) return;
        const data = await res.json();
        // Look for any non-test request
        const realRequest = data.requests?.find(
          (r: { refCode: string }) => !r.refCode?.startsWith("HS-TEST-")
        );
        if (realRequest) {
          stopPolling();
          setPolling(false);
          setFound(true);
        }
      } catch {
        // Keep polling
      }
    }, 3000);
  }, [stopPolling]);

  const handleCopy = () => {
    copyToClipboard(PROMPT_TIP);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const platformName =
    clientChannel === "codex"
      ? "Codex"
      : clientChannel === "gemini"
        ? "Gemini CLI"
        : clientChannel === "cursor"
          ? "Cursor"
          : clientChannel === "openclaw"
            ? "OpenClaw"
            : "Claude Code";

  return (
    <div>
      <h2 className="mb-1 font-serif text-lg font-semibold text-foreground">
        Try it for real
      </h2>
      <p className="mb-5 text-sm text-muted-foreground">
        The test worked. Now trigger a real help request from {platformName} to
        experience the full flow in your own project.
      </p>

      {!found ? (
        <div className="space-y-4">
          {/* Instructions */}
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground mb-2">
              How to trigger your first request:
            </p>
            <ol className="space-y-2 text-xs text-muted-foreground list-decimal list-inside">
              <li>
                Open a project where you installed the HeySummon skill
              </li>
              <li>
                Start {platformName} and give it a task with an intentionally
                ambiguous requirement
              </li>
              <li>
                The agent will use HeySummon to ask you for clarification
              </li>
              <li>Answer via your expert channel and watch it continue</li>
            </ol>
          </div>

          {/* Prompt tip */}
          <div className="rounded-lg border border-border bg-[#0d1117] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-wide">
                Tip: add this to your agent&apos;s context
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
              >
                {copied ? (
                  "Copied!"
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
              {PROMPT_TIP}
            </pre>
          </div>

          {/* Polling status */}
          {polling ? (
            <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shrink-0" />
              <p className="text-sm text-foreground">
                Listening for your first real request...
              </p>
            </div>
          ) : (
            <button
              onClick={startPolling}
              className="w-full rounded-md border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="flex items-center justify-center gap-2">
                Start listening for requests
              </span>
            </button>
          )}

          {/* Skip */}
          <div className="text-center">
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              I&apos;ll do this later
              <ArrowRight className="h-3 w-3" />
            </button>
            <p className="mt-1 text-[10px] text-muted-foreground/60">
              You can always test this from your dashboard
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-300">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 shrink-0 animate-in zoom-in duration-300">
              <Check className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                First real request received!
              </p>
              <p className="text-xs text-muted-foreground">
                Your setup is working in a real project. You&apos;re all set.
              </p>
            </div>
          </div>

          <button
            onClick={onNext}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80 transition-colors"
          >
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
