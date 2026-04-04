"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

interface ResponseFormProps {
  requestId: string;
  currentStatus: string;
  existingResponse: string | null;
  e2e?: boolean;
  onE2ESend?: (text: string) => Promise<{ success: boolean; error?: string }>;
}

export function ResponseForm({
  requestId,
  currentStatus,
  existingResponse,
  e2e,
  onE2ESend,
}: ResponseFormProps) {
  const router = useRouter();
  const [response, setResponse] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const canRespond =
    currentStatus === "reviewing" ||
    currentStatus === "pending" ||
    currentStatus === "active" ||
    currentStatus === "responded";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!response.trim()) return;

    setError("");
    setSending(true);

    try {
      if (e2e && onE2ESend) {
        // E2E encrypted send
        const result = await onE2ESend(response.trim());
        if (!result.success) {
          setError(result.error || "Failed to send encrypted message");
          return;
        }
        setResponse("");
      } else {
        // Legacy plaintext send
        const res = await fetch(`/api/v1/requests/${requestId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ response: response.trim() }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Failed to send response");
          return;
        }

        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (!e2e && currentStatus === "responded") {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <p className="mb-2 text-sm font-semibold text-green-400">
          Your Response
        </p>
        <p className="whitespace-pre-wrap text-sm text-zinc-200">
          {existingResponse}
        </p>
      </div>
    );
  }

  if (currentStatus === "expired") {
    return (
      <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center text-sm text-red-400">
        This request has expired and can no longer be responded to.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {e2e && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-green-400">
          <Lock className="h-3 w-3" />
          Your message will be end-to-end encrypted
        </div>
      )}

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder={
          e2e
            ? "Write an encrypted response..."
            : "Write a response the user can forward to their AI..."
        }
        rows={6}
        disabled={!canRespond}
        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
      />

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={sending || !response.trim() || !canRespond}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
        >
          {e2e && <Lock className="h-3.5 w-3.5" />}
          {sending ? "Sending..." : e2e ? "Send Encrypted" : "Send Response"}
        </button>
      </div>
    </form>
  );
}
