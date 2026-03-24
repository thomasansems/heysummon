"use client";

import { useState, useCallback, useRef } from "react";

export type VerifyStatus = "idle" | "checking" | "connected" | "timeout";

interface UseConnectionVerifyOptions {
  keyId: string;
  endpoint?: string;
  pollIntervalMs?: number;
  timeoutMs?: number;
}

interface UseConnectionVerifyResult {
  status: VerifyStatus;
  elapsed: number;
  connectedIp: string | null;
  start: () => void;
  retry: () => void;
  stop: () => void;
}

export function useConnectionVerify({
  keyId,
  endpoint = "/api/v1/setup/verify",
  pollIntervalMs = 2000,
  timeoutMs = 60_000,
}: UseConnectionVerifyOptions): UseConnectionVerifyResult {
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [connectedIp, setConnectedIp] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    setStatus("checking");
    setElapsed(0);
    setConnectedIp(null);
    const startTime = Date.now();

    intervalRef.current = setInterval(async () => {
      const elapsedMs = Date.now() - startTime;
      setElapsed(Math.floor(elapsedMs / 1000));

      if (elapsedMs > timeoutMs) {
        stop();
        setStatus("timeout");
        return;
      }

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyId }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.connected) {
            stop();
            setStatus("connected");
            setConnectedIp(data.allowedIps?.[0] ?? null);
          }
        }
      } catch {
        // Network error — keep polling
      }
    }, pollIntervalMs);
  }, [keyId, endpoint, pollIntervalMs, timeoutMs, stop]);

  const retry = useCallback(() => {
    start();
  }, [start]);

  return { status, elapsed, connectedIp, start, retry, stop };
}
