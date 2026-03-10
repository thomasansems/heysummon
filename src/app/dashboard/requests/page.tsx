"use client";

import { copyToClipboard } from "@/lib/clipboard";

import { useEffect, useState, useCallback } from "react";

function CopyableRefCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span>—</span>;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono text-xs text-foreground hover:text-violet-600 cursor-pointer relative"
      title="Click to copy"
    >
      {code}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-xs text-background whitespace-nowrap">
          Copied!
        </span>
      )}
    </button>
  );
}

interface HelpRequest {
  id: string;
  refCode: string | null;
  status: string;
  messageCount: number;
  responseCount: number;
  createdAt: string;
  deliveredAt: string | null;
  apiKey: { name: string | null };
}

const FILTERS = ["all", "pending", "responded", "failed", "expired"] as const;

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-950/60 text-yellow-300",
  responded: "bg-emerald-950/60 text-emerald-300",
  expired: "bg-slate-950/60 text-slate-300",
  failed: "bg-red-950/60 text-red-300",
};

const dotStyles: Record<string, string> = {
  pending: "bg-yellow-500",
  responded: "bg-green-500",
  expired: "bg-red-500",
  failed: "bg-red-500",
};

const statusLabels: Record<string, string> = {
  pending: "Awaiting Response",
  responded: "Responded",
  expired: "Expired",
  failed: "Failed",
};

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function deliveryTime(created: string, delivered: string | null) {
  if (!delivered) return "—";
  const ms = new Date(delivered).getTime() - new Date(created).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchRequests = useCallback(() => {
    fetch("/api/v1/requests")
      .then((r) => r.json())
      .then((data) => {
        setRequests(data.requests || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Poll for updates every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchRequests, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Requests</h1>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${
              filter === f
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {loading ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Ref Code</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Responses</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  Delivery Time
                </th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-16 rounded bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-5 w-32 rounded-full bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-24 rounded bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-8 rounded bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-20 rounded bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-4 w-16 rounded bg-[#eaeaea]"></div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="ml-auto h-4 w-16 rounded bg-[#eaeaea]"></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No requests found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Ref Code</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Responses</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  Delivery Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5">
                    <CopyableRefCode code={req.refCode} />
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusStyles[req.status] || ""
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          dotStyles[req.status] || ""
                        }`}
                      />
                      {statusLabels[req.status] || req.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {req.messageCount > 0
                      ? `${req.messageCount} berichten`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {req.responseCount > 0
                      ? <span className="inline-flex items-center gap-1 text-green-600 font-medium">{req.responseCount}</span>
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {req.apiKey.name || "Unnamed"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {timeAgo(req.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">
                    {deliveryTime(req.createdAt, req.deliveredAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
