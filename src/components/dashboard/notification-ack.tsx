"use client";

import { useState } from "react";
import { Check, CheckCircle2 } from "lucide-react";

interface NotificationAckProps {
  requestId: string;
  status: string;
  acknowledgedAt: string | null;
  expiresAt: string;
  onAcknowledged?: () => void;
}

export function NotificationAck({
  requestId,
  status,
  acknowledgedAt,
  expiresAt,
  onAcknowledged,
}: NotificationAckProps) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [localAckAt, setLocalAckAt] = useState<string | null>(acknowledgedAt);

  const effectiveAckAt = localAckAt ?? acknowledgedAt;
  const isExpired = status === "expired";

  async function handleAcknowledge() {
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/v1/acknowledge/${requestId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to acknowledge");
        return;
      }

      const data = await res.json().catch(() => ({}));
      const ackAt = typeof data.acknowledgedAt === "string" ? data.acknowledgedAt : new Date().toISOString();
      setLocalAckAt(ackAt);
      onAcknowledged?.();
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (isExpired) {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center text-sm text-red-400">
        This notification expired on {new Date(expiresAt).toLocaleString()} and was not acknowledged.
      </div>
    );
  }

  if (effectiveAckAt) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <div className="flex items-center gap-2 text-sm text-green-400">
          <CheckCircle2 className="h-4 w-4" />
          <span className="font-semibold">Acknowledged</span>
          <span className="text-xs text-muted-foreground">
            {new Date(effectiveAckAt).toLocaleString()}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          No reply is expected. Mark this notification as seen.
        </p>
        <button
          type="button"
          onClick={handleAcknowledge}
          disabled={sending}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {sending ? "Acknowledging..." : "Acknowledge"}
        </button>
      </div>
    </div>
  );
}
