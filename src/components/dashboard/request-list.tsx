"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { StatusBadge } from "./status-badge";

interface ContentFlag {
  type: "xss" | "url" | "credit_card" | "phone" | "email" | "ssn_bsn";
  original: string;
  replacement: string;
}

interface HelpRequestItem {
  id: string;
  status: string;
  question: string | null;
  createdAt: string;
  deliveredAt: string | null;
  contentFlags: ContentFlag[] | null;
  guardVerified: boolean;
  apiKey: { name: string | null };
}

const SPAM_FLAG_TYPES = new Set(["xss", "credit_card", "ssn_bsn"]);

function getFlagLabel(type: string): string {
  const labels: Record<string, string> = {
    xss: "XSS",
    url: "URL defanged",
    credit_card: "Credit card",
    phone: "Phone redacted",
    email: "Email redacted",
    ssn_bsn: "SSN/BSN",
  };
  return labels[type] || type;
}

const filterOptions = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "reviewing", label: "Reviewing" },
  { value: "responded", label: "Responded" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
  { value: "flagged", label: "Flagged" },
];

export function RequestList({ expertId }: { expertId?: string }) {
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

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchRequests, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setFilter(opt.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === opt.value
                ? "bg-orange-600 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          Loading...
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/30 p-8 text-center text-muted-foreground">
          No requests found.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card">
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
                {req.contentFlags && req.contentFlags.length > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-700 dark:text-red-400"
                    title={req.contentFlags.map((f) => getFlagLabel(f.type)).join(", ")}
                  >
                    <ShieldAlert className="h-3 w-3" />
                    {req.contentFlags.some((f) => SPAM_FLAG_TYPES.has(f.type)) ? "Blocked" : "Sanitized"}
                  </span>
                )}
                {!req.deliveredAt && req.status === "pending" && (
                  <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
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
