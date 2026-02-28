"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ResponseForm({
  requestId,
  currentStatus,
  existingResponse,
}: {
  requestId: string;
  currentStatus: string;
  existingResponse: string | null;
}) {
  const router = useRouter();
  const [response, setResponse] = useState(existingResponse || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const canRespond = currentStatus === "reviewing" || currentStatus === "pending";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!response.trim()) return;

    setError("");
    setSending(true);

    try {
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
    } catch {
      setError("Something went wrong");
    } finally {
      setSending(false);
    }
  }

  if (currentStatus === "responded") {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5">
        <p className="mb-2 text-sm font-semibold text-green-400">Your Response</p>
        <p className="whitespace-pre-wrap text-sm text-zinc-200">{existingResponse}</p>
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

      <textarea
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Write a response the user can forward to their AI..."
        rows={6}
        disabled={!canRespond}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition-colors focus:border-violet-500 focus:ring-1 focus:ring-violet-500 disabled:opacity-50"
      />

      <div className="mt-3 flex justify-end">
        <button
          type="submit"
          disabled={sending || !response.trim() || !canRespond}
          className="rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
        >
          {sending ? "Sending..." : "Send Response"}
        </button>
      </div>
    </form>
  );
}
