"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { StatusBadge } from "./status-badge";

interface Request {
  id: string;
  status: string;
  question: string | null;
  createdAt: string;
  apiKey: { name: string | null };
}

export function RecentActivity() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/requests?limit=5")
      .then((res) => res.json())
      .then((data) => setRequests(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
        Loading...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
        No help requests yet. Share your API key to start receiving requests.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50">
      {requests.map((req) => (
        <Link
          key={req.id}
          href={`/dashboard/requests/${req.id}`}
          className="flex items-center justify-between border-b border-zinc-800 px-5 py-4 transition-colors last:border-0 hover:bg-zinc-800/30"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-zinc-200">
              {req.question || "No question provided"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {new Date(req.createdAt).toLocaleString()} · via{" "}
              {req.apiKey.name || "Unnamed key"}
            </p>
          </div>
          <StatusBadge status={req.status} />
        </Link>
      ))}
    </div>
  );
}
