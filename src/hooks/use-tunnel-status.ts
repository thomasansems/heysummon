"use client";

import { useState, useCallback } from "react";

export interface TunnelStatus {
  accessible: boolean;
  active: boolean;
  method: "tailscale" | "cloudflared" | "custom" | "none";
  publicUrl: string | null;
  hostname: string | null;
  tailscaleAvailable: boolean;
  cloudflaredAvailable: boolean;
  needsOperatorSetup: boolean;
}

const DEFAULT_STATUS: TunnelStatus = {
  accessible: false,
  active: false,
  method: "none",
  publicUrl: null,
  hostname: null,
  tailscaleAvailable: false,
  cloudflaredAvailable: false,
  needsOperatorSetup: false,
};

interface UseTunnelStatusResult {
  status: TunnelStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  startTunnel: (type: "tailscale" | "cloudflared") => Promise<boolean>;
}

export function useTunnelStatus(): UseTunnelStatusResult {
  const [status, setStatus] = useState<TunnelStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tunnel/status");
      if (!res.ok) throw new Error("Failed to check tunnel status");
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const startTunnel = useCallback(
    async (type: "tailscale" | "cloudflared"): Promise<boolean> => {
      setError(null);
      try {
        const endpoint =
          type === "tailscale"
            ? "/api/admin/tunnel/start"
            : "/api/admin/cloudflared/start";
        const res = await fetch(endpoint, { method: "POST" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `Failed to start ${type} tunnel`);
        }
        // Refresh status after starting
        await refresh();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        return false;
      }
    },
    [refresh]
  );

  return { status, loading, error, refresh, startTunnel };
}
