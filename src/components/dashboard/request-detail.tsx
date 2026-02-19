"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatDisplay } from "./chat-display";
import { ResponseForm } from "./response-form";
import { StatusBadge } from "./status-badge";

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
  apiKey: { name: string | null };
}

export function RequestDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<HelpRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/requests/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => setRequest(data.request))
      .catch(() => setError("Request not found"))
      .finally(() => setLoading(false));
  }, [id]);

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
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            {new Date(request.createdAt).toLocaleString()} · via{" "}
            {request.apiKey.name || "Unnamed key"} · Expires{" "}
            {new Date(request.expiresAt).toLocaleString()}
          </p>
        </div>
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
