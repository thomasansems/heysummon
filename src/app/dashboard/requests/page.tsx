"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { useEffect, useState, useCallback } from "react";
import { Inbox } from "lucide-react";

function CopyableRefCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono text-xs text-foreground hover:text-primary transition-colors cursor-pointer relative"
    >
      {code}
      {copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-popover border border-border px-2 py-1 text-[10px] text-popover-foreground whitespace-nowrap shadow-md">
          Copied
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

const statusConfig: Record<string, { dot: string; text: string; label: string }> = {
  pending: { dot: "bg-amber-500", text: "text-amber-600", label: "Pending" },
  responded: { dot: "bg-emerald-500", text: "text-emerald-600", label: "Responded" },
  expired: { dot: "bg-zinc-400", text: "text-zinc-500", label: "Expired" },
  failed: { dot: "bg-red-500", text: "text-red-600", label: "Failed" },
  active: { dot: "bg-blue-500", text: "text-blue-600", label: "Active" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { dot: "bg-zinc-400", text: "text-zinc-500", label: status };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
    </span>
  );
}

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
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const filtered = filter === "all" ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Requests</h1>
          <p className="text-sm text-muted-foreground">{requests.length} total requests</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 w-fit rounded-lg border border-border bg-muted/40 p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-all ${
              filter === f
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Ref</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Messages</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Responses</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Client</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Created</th>
              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground hidden lg:table-cell">Delivery</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border animate-pulse">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 w-20 rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Inbox className="h-8 w-8 opacity-40" />
                    <span className="text-sm">No requests found</span>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((req) => (
                <tr key={req.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <CopyableRefCode code={req.refCode} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={req.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {req.messageCount > 0 ? `${req.messageCount} message${req.messageCount !== 1 ? "s" : ""}` : "—"}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {req.responseCount > 0 ? (
                      <span className="text-emerald-600 font-medium text-xs">{req.responseCount}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    <span className="text-xs">{req.apiKey.name || "Unnamed"}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <span className="text-xs">{timeAgo(req.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground hidden lg:table-cell">
                    <span className="text-xs">{deliveryTime(req.createdAt, req.deliveredAt)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
