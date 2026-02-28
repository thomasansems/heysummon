"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChatDisplay } from "./chat-display";
import { ResponseForm } from "./response-form";
import { StatusBadge } from "./status-badge";
import { useRequestMercure } from "@/hooks/useMercure";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface HelpRequestDetail {
  id: string;
  status: string;
  question: string | null;
  messages: Message[];
  response: string | null;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  deliveredAt: string | null;
  apiKey: { name: string | null };
}

export function RequestDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<HelpRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const fetchRequest = useCallback(() => {
    fetch(`/api/v1/requests/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setRequest(data.request))
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  // Realtime updates via Mercure (new messages, closed, etc.)
  useRequestMercure(id, useCallback((event) => {
    if (event.type === "new_message" || event.type === "closed" || event.type === "keys_exchanged") {
      fetchRequest();
    }
  }, [fetchRequest]));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-zinc-500">{error || "Request not found"}</p>
        <Link href="/dashboard/requests" className="text-sm text-violet-400 hover:text-violet-300">
          Back to requests
        </Link>
      </div>
    );
  }

  const handleResend = async () => {
    setResending(true);
    setResendMessage("");
    try {
      const res = await fetch(`/api/v1/requests/${id}/resend`, { method: "POST" });
      if (res.ok) {
        setResendMessage("✅ Notification resent");
        fetchRequest();
      } else {
        const data = await res.json();
        setResendMessage(`❌ ${data.error || "Failed to resend"}`);
      }
    } catch {
      setResendMessage("❌ Network error");
    } finally {
      setResending(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/requests"
            className="mb-2 inline-block text-sm text-zinc-400 hover:text-zinc-200"
          >
            &larr; Back to requests
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Help Request</h1>
            <StatusBadge status={request.status} />
            {request.deliveredAt ? (
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                ✓ Delivered
              </span>
            ) : request.status !== "closed" && request.status !== "expired" ? (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                ⏳ Not delivered
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(request.createdAt).toLocaleString()} · via{" "}
            {request.apiKey.name || "Unnamed key"} · Expires{" "}
            {new Date(request.expiresAt).toLocaleString()}
            {request.deliveredAt && (
              <> · Delivered {new Date(request.deliveredAt).toLocaleString()}</>
            )}
          </p>
        </div>
        {!request.deliveredAt && request.status !== "closed" && request.status !== "expired" && (
          <div className="flex flex-col items-end gap-1">
            <button
              onClick={handleResend}
              disabled={resending}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
            >
              {resending ? "Resending..." : "🔔 Resend Notification"}
            </button>
            {resendMessage && (
              <span className="text-xs text-zinc-400">{resendMessage}</span>
            )}
          </div>
        )}
      </div>

      {request.question && (
        <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-violet-400">
            User&apos;s Question
          </p>
          <p className="text-sm text-zinc-200">{request.question}</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Chat History ({request.messages.length} messages)
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5">
          <ChatDisplay messages={request.messages} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">Expert Response</h2>
        <ResponseForm
          requestId={request.id}
          currentStatus={request.status}
          existingResponse={request.response}
        />
      </div>
    </div>
  );
}
