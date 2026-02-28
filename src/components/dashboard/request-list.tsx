"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { StatusBadge } from "./status-badge";
import { useProviderMercure } from "@/hooks/useMercure";

interface HelpRequestItem {
  id: string;
  status: string;
  question: string | null;
  createdAt: string;
  deliveredAt: string | null;
  apiKey: { name: string | null };
}

const filterOptions = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "reviewing", label: "Reviewing" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
];

export function RequestList({ providerId }: { providerId?: string }) {
  const [requests, setRequests] = useState<HelpRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  const fetchRequests = useCallback(() => {
    setLoading(true);
    const url = filter ? `/api/v1/requests?status=${filter}` : "/api/v1/requests";
    fetch(url)
      .then((res) => res.json())
      .then((data) => setRequests(data.requests || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime updates via Mercure
  useProviderMercure(providerId, useCallback((event) => {
    if (event.type === "new_request" || event.type === "status_change" || event.type === "closed") {
      fetchRequests();
    }
  }, [fetchRequests]));

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.value
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          Loading...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-500">
          No requests found.
        </div>
      ) : (
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
              <div className="flex items-center gap-2">
                {!req.deliveredAt && req.status === "pending" && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    ⏳
                  </span>
                )}
                <StatusBadge status={req.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
