"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Phone, ShieldAlert, ShieldCheck } from "lucide-react";
import { ChatDisplay } from "./chat-display";
import { ResponseForm } from "./response-form";
import { StatusBadge } from "./status-badge";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ContentFlag {
  type: "xss" | "url" | "credit_card" | "phone" | "email" | "ssn_bsn";
  original: string;
  replacement: string;
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
  phoneCallStatus: string | null;
  phoneCallAt: string | null;
  phoneCallResponse: string | null;
  phoneCallSid: string | null;
  contentFlags: ContentFlag[] | null;
  guardVerified: boolean;
}

const FLAG_LABELS: Record<string, string> = {
  xss: "Script injection (XSS)",
  url: "URL defanged",
  credit_card: "Credit card detected",
  phone: "Phone number redacted",
  email: "Email address redacted",
  ssn_bsn: "SSN/BSN detected",
};

const FLAG_COLORS: Record<string, string> = {
  xss: "text-red-500",
  credit_card: "text-red-500",
  ssn_bsn: "text-red-500",
  url: "text-amber-500",
  email: "text-blue-500",
  phone: "text-blue-500",
};

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

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchRequest, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequest]);

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
        <Link href="/dashboard/requests" className="text-sm text-orange-400 hover:text-orange-300">
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
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
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
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-500 disabled:opacity-50"
            >
              {resending ? "Resending..." : "🔔 Resend Notification"}
            </button>
            {resendMessage && (
              <span className="text-xs text-zinc-400">{resendMessage}</span>
            )}
          </div>
        )}
      </div>

      {request.phoneCallStatus && (
        <div className="mb-6 rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone Call</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Status:{" "}
              <span className={{
                initiated: "text-blue-500",
                ringing: "text-blue-500",
                answered: "text-green-500",
                completed: "text-green-500",
                "no-answer": "text-amber-500",
                busy: "text-amber-500",
                failed: "text-red-500",
              }[request.phoneCallStatus] || "text-muted-foreground"}>
                {{
                  initiated: "Calling...",
                  ringing: "Ringing...",
                  answered: "On call",
                  completed: "Answered",
                  "no-answer": "No answer — fell back to chat",
                  busy: "Busy — fell back to chat",
                  failed: "Call failed — fell back to chat",
                }[request.phoneCallStatus] || request.phoneCallStatus}
              </span>
            </span>
            {request.phoneCallAt && (
              <span className="text-muted-foreground">
                Called at {new Date(request.phoneCallAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          {request.phoneCallResponse && (
            <div className="mt-3 rounded-lg bg-muted/40 p-3">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Verbal response</p>
              <p className="text-sm">{request.phoneCallResponse}</p>
            </div>
          )}
        </div>
      )}

      {request.contentFlags && request.contentFlags.length > 0 && (
        <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <p className="text-xs font-semibold uppercase tracking-wider text-red-700 dark:text-red-400">
              Content Safety Flags
            </p>
          </div>
          <div className="space-y-2">
            {request.contentFlags.map((flag, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className={`font-medium ${FLAG_COLORS[flag.type] || "text-muted-foreground"}`}>
                  {FLAG_LABELS[flag.type] || flag.type}
                </span>
              </div>
            ))}
          </div>
          {request.guardVerified && (
            <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-green-500" />
              Content was sanitized by the guard before storage
            </div>
          )}
        </div>
      )}

      {!request.contentFlags?.length && request.guardVerified && (
        <div className="mb-6 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          Verified clean by guard
        </div>
      )}

      {request.question && (
        <div className="mb-6 rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-orange-700 dark:text-orange-400">
            User&apos;s Question
          </p>
          <p className="text-sm text-zinc-200">{request.question}</p>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-zinc-400">
          Chat History ({request.messages.length} messages)
        </h2>
        <div className="rounded-xl border border-border bg-card/30 p-5">
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
