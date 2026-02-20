import { copyToClipboard } from "@/lib/clipboard";
"use client";

import { useEffect, useState, useCallback } from "react";
import { useProviderMercure } from "@/hooks/useMercure";

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
      className="font-mono text-xs text-black hover:text-violet-600 cursor-pointer relative"
      title="Click to copy"
    >
      {code}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-black px-2 py-0.5 text-xs text-white whitespace-nowrap">
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
  question: string | null;
  messageCount: number;
  createdAt: string;
  respondedAt: string | null;
  apiKey: { name: string | null };
}

const FILTERS = ["all", "pending", "responded", "expired"] as const;

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-50 text-yellow-700",
  responded: "bg-green-50 text-green-700",
  expired: "bg-red-50 text-red-700",
};

const dotStyles: Record<string, string> = {
  pending: "bg-yellow-500",
  responded: "bg-green-500",
  expired: "bg-red-500",
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

function responseTime(created: string, responded: string | null) {
  if (!responded) return "—";
  const ms = new Date(responded).getTime() - new Date(created).getTime();
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [filter, setFilter] = useState<string>("all");

  const fetchRequests = useCallback(() => {
    fetch("/api/requests")
      .then((r) => r.json())
      .then((data) => setRequests(data.requests || []));
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Realtime updates via Mercure
  useProviderMercure(undefined, useCallback((event) => {
    if (event.type === "new_request" || event.type === "status_change" || event.type === "closed") {
      fetchRequests();
    }
  }, [fetchRequests]));

  const filtered =
    filter === "all"
      ? requests
      : requests.filter((r) => r.status === filter);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-black">Requests</h1>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-[#eaeaea] bg-white p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1 text-sm capitalize transition-colors ${
              filter === f
                ? "bg-black text-white"
                : "text-[#666] hover:text-black"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#666]">
            No requests found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
                <th className="px-4 py-2.5 font-medium">Ref Code</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Preview</th>
                <th className="px-4 py-2.5 font-medium">Messages</th>
                <th className="px-4 py-2.5 font-medium">Client</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium text-right">
                  Response Time
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => (
                <tr
                  key={req.id}
                  className="border-b border-[#eaeaea] last:border-0"
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
                      {req.status.charAt(0).toUpperCase() +
                        req.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#666] max-w-xs truncate">
                    {req.question
                      ? <span title={req.question}>{req.question.slice(0, 240)}</span>
                      : <span className="italic text-[#999]">No question</span>}
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {req.messageCount > 0
                      ? `${req.messageCount} berichten`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {req.apiKey.name || "Unnamed"}
                  </td>
                  <td className="px-4 py-2.5 text-[#666]">
                    {timeAgo(req.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-[#666]">
                    {responseTime(req.createdAt, req.respondedAt)}
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
