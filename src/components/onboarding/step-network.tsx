"use client";

import { useEffect, useState } from "react";
import { useTunnelStatus } from "@/hooks/use-tunnel-status";
import { AlertTriangle, Loader2, Check, Wifi } from "lucide-react";

interface StepNetworkProps {
  onNext: () => void;
}

export function StepNetwork({ onNext }: StepNetworkProps) {
  const { status, loading, error, refresh, startTunnel } = useTunnelStatus();
  const [starting, setStarting] = useState<"tailscale" | "cloudflared" | null>(null);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-skip if already accessible
  useEffect(() => {
    if (!loading && status.accessible) {
      const timer = setTimeout(onNext, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, status.accessible, onNext]);

  const handleStart = async (type: "tailscale" | "cloudflared") => {
    setStarting(type);
    const success = await startTunnel(type);
    setStarting(null);
    if (success) {
      // Status will be refreshed by startTunnel, auto-skip will trigger
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking network access...</p>
      </div>
    );
  }

  if (status.accessible) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-600">
          <Check className="h-6 w-6 text-white" />
        </div>
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Network is ready
        </h2>
        <p className="text-sm text-muted-foreground">
          Your server is publicly accessible
          {status.publicUrl && (
            <span className="block mt-1 font-mono text-xs text-green-600">
              {status.publicUrl}
            </span>
          )}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        <h2 className="font-serif text-lg font-semibold text-foreground">
          Public Access
        </h2>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        HeySummon needs to be accessible from the internet so experts can receive
        webhook notifications (e.g., Telegram bots). Choose a tunnel method to enable
        public access.
      </p>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {status.tailscaleAvailable && (
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Tailscale Funnel
                </span>
                <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                  Available
                </span>
              </div>
              <button
                onClick={() => handleStart("tailscale")}
                disabled={!!starting}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
              >
                {starting === "tailscale" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Starting...
                  </span>
                ) : (
                  "Start Funnel"
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expose your server via Tailscale&apos;s built-in HTTPS tunnel.
            </p>
            {status.needsOperatorSetup && (
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                Requires operator permissions — run{" "}
                <code className="rounded bg-muted px-1">
                  tailscale set --operator=$USER
                </code>{" "}
                first.
              </p>
            )}
          </div>
        )}

        {status.cloudflaredAvailable && (
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Cloudflare Tunnel
                </span>
                <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:text-green-300">
                  Available
                </span>
              </div>
              <button
                onClick={() => handleStart("cloudflared")}
                disabled={!!starting}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/80 disabled:opacity-40"
              >
                {starting === "cloudflared" ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="h-3 w-3 animate-spin" /> Starting...
                  </span>
                ) : (
                  "Start Tunnel"
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Quick tunnel via Cloudflare — no account needed.
            </p>
          </div>
        )}

        {!status.tailscaleAvailable && !status.cloudflaredAvailable && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground mb-2">
              No tunnel tools detected
            </p>
            <p className="text-xs text-muted-foreground">
              Install{" "}
              <a
                href="https://tailscale.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                Tailscale
              </a>{" "}
              or{" "}
              <a
                href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-orange-400 hover:underline"
              >
                cloudflared
              </a>
              , or set the <code className="rounded bg-muted px-1 text-xs">HEYSUMMON_PUBLIC_URL</code>{" "}
              environment variable if your server is already publicly accessible.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={onNext}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Skip — I&apos;ll configure later
        </button>
        <button
          onClick={refresh}
          className="rounded-md bg-muted px-3 py-1.5 text-sm text-foreground hover:bg-muted/80"
        >
          Re-check
        </button>
      </div>
    </div>
  );
}
