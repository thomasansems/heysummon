"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { X, RotateCcw, ArrowDownLeft, ArrowUpRight, Phone, Clock } from "lucide-react";

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
      className="font-mono text-xs text-foreground hover:text-orange-600 cursor-pointer relative"
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
  requiresApproval: boolean;
  approvalDecision: string | null;
  messageCount: number;
  inbound: number;
  outbound: number;
  createdAt: string;
  deliveredAt: string | null;
  phoneCallStatus: string | null;
  phoneCallAt: string | null;
  clientTimedOutAt: string | null;
  apiKey: { name: string | null; provider: { name: string } | null };
}

const FILTERS = [
  "all",
  "pending",
  "responded",
  "failed",
  "expired",
  "cancelled",
] as const;

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300",
  delivered: "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
  responded: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  denied: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  expired: "bg-slate-100 text-slate-600 dark:bg-slate-950/60 dark:text-slate-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
};

const dotStyles: Record<string, string> = {
  pending: "bg-yellow-500",
  delivered: "bg-teal-400",
  responded: "bg-green-500",
  approved: "bg-green-500",
  denied: "bg-red-500",
  expired: "bg-slate-500",
  failed: "bg-red-500",
  cancelled: "bg-red-400",
};

const statusLabels: Record<string, string> = {
  pending: "Awaiting Response",
  delivered: "Delivered",
  responded: "Responded",
  approved: "Approved",
  denied: "Denied",
  expired: "Expired",
  failed: "Failed",
  cancelled: "Cancelled",
};

const phoneCallLabels: Record<string, string> = {
  initiated: "Calling...",
  ringing: "Ringing...",
  answered: "On call",
  completed: "Call answered",
  "no-answer": "No answer",
  busy: "Busy",
  failed: "Call failed",
};

const phoneCallStyles: Record<string, string> = {
  initiated: "text-blue-600 dark:text-blue-400",
  ringing: "text-blue-600 dark:text-blue-400",
  answered: "text-green-600 dark:text-green-400",
  completed: "text-green-600 dark:text-green-400",
  "no-answer": "text-amber-600 dark:text-amber-400",
  busy: "text-amber-600 dark:text-amber-400",
  failed: "text-red-600 dark:text-red-400",
};

function PhoneCallBadge({ status }: { status: string | null }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${phoneCallStyles[status] || "text-muted-foreground"}`}
      title={`Phone call: ${status}`}
    >
      <Phone className="h-3 w-3" />
      {phoneCallLabels[status] || status}
    </span>
  );
}

function ClientTimeoutBadge({ timedOutAt }: { timedOutAt: string | null }) {
  if (!timedOutAt) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 text-xs font-medium"
      title={`Client timed out: ${new Date(timedOutAt).toLocaleString()}`}
    >
      <Clock className="h-3 w-3" />
      Client Timed Out
    </span>
  );
}

function getDisplayStatus(req: HelpRequest): string {
  if (req.approvalDecision) {
    return req.approvalDecision; // "approved" | "denied"
  }
  if (
    req.deliveredAt &&
    (req.status === "pending" || req.status === "active")
  ) {
    return "delivered";
  }
  return req.status;
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

export default function RequestsContent() {
  const searchParams = useSearchParams();
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string | null>(searchParams.get("client"));
  const [providerFilter, setProviderFilter] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<string>("all");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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

  useEffect(() => {
    const interval = setInterval(fetchRequests, 10_000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  async function handleCancel(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/v1/dashboard/requests/${id}/cancel`, {
        method: "POST",
      });
      if (res.ok) fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResend(id: string) {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/v1/dashboard/requests/${id}/resend`, {
        method: "POST",
      });
      if (res.ok) fetchRequests();
    } finally {
      setActionLoading(null);
    }
  }

  const uniqueClients = useMemo(() => {
    const set = new Set(requests.map((r) => r.apiKey.name || "Unnamed"));
    return Array.from(set).sort();
  }, [requests]);

  const uniqueProviders = useMemo(() => {
    const set = new Set(requests.map((r) => r.apiKey.provider?.name).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [requests]);

  const filtered = requests.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false;
    if (clientFilter && (r.apiKey.name || "Unnamed") !== clientFilter && r.apiKey.name !== clientFilter) return false;
    if (providerFilter && r.apiKey.provider?.name !== providerFilter) return false;
    if (timeFilter !== "all") {
      const now = Date.now();
      const created = new Date(r.createdAt).getTime();
      if (timeFilter === "24h" && now - created > 86_400_000) return false;
      if (timeFilter === "7d" && now - created > 7 * 86_400_000) return false;
      if (timeFilter === "30d" && now - created > 30 * 86_400_000) return false;
    }
    return true;
  });

  const thClass = "px-4 py-2.5 font-medium";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-foreground">Requests</h1>

      {/* Filter tabs + dropdowns */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-card p-1 w-fit">
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

        <select
          value={clientFilter || ""}
          onChange={(e) => setClientFilter(e.target.value || null)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
        >
          <option value="">All clients</option>
          {uniqueClients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {uniqueProviders.length > 0 && (
          <select
            value={providerFilter || ""}
            onChange={(e) => setProviderFilter(e.target.value || null)}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
          >
            <option value="">All providers</option>
            {uniqueProviders.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <select
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-ring"
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {loading ? (
          <>
            <div className="md:hidden">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="border-b border-border p-4 space-y-3 last:border-0 animate-pulse">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-16 rounded bg-muted"></div>
                    <div className="h-6 w-16 rounded bg-muted"></div>
                  </div>
                  <div className="h-5 w-32 rounded-full bg-muted"></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-4 w-24 rounded bg-muted"></div>
                    <div className="h-4 w-8 rounded bg-muted"></div>
                    <div className="h-4 w-20 rounded bg-muted"></div>
                    <div className="h-4 w-16 rounded bg-muted"></div>
                  </div>
                  <div className="h-4 w-16 rounded bg-muted"></div>
                </div>
              ))}
            </div>
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className={thClass}>Ref Code</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Messages</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Created</th>
                  <th className={`${thClass} text-right`}>Delivery Time</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 4].map((i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-16 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-5 w-32 rounded-full bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-24 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-8 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-20 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="h-4 w-16 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="ml-auto h-4 w-16 rounded bg-muted"></div>
                    </td>
                    <td className="px-4 py-2.5"></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No requests found
          </div>
        ) : (
          <>
            <div className="md:hidden">
              {filtered.map((req) => {
                const display = getDisplayStatus(req);
                const canCancel =
                  req.status === "pending" || req.status === "active";
                const canResend = ["responded", "failed", "expired"].includes(
                  req.status
                );
                const isLoading = actionLoading === req.id;

                return (
                  <div key={req.id} className="border-b border-border p-4 space-y-3 last:border-0">
                    <div className="flex items-center justify-between">
                      <CopyableRefCode code={req.refCode} />
                      <div className="flex items-center gap-1">
                        {canCancel && (
                          <button onClick={() => handleCancel(req.id)} disabled={isLoading} title="Cancel"
                            className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {canResend && (
                          <button onClick={() => handleResend(req.id)} disabled={isLoading} title="Resend"
                            className="rounded p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Status</span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusStyles[display] || ""
                          }`}
                          title={
                            display === "delivered" && req.deliveredAt
                              ? `Delivered: ${new Date(req.deliveredAt).toLocaleString()}`
                              : undefined
                          }
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              dotStyles[display] || ""
                            }`}
                          />
                          {statusLabels[display] || req.status}
                        </span>
                        {req.requiresApproval && !req.approvalDecision && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                            Approval Required
                          </span>
                        )}
                        <PhoneCallBadge status={req.phoneCallStatus} />
                        <ClientTimeoutBadge timedOutAt={req.clientTimedOutAt} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Messages</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5" title="Inbound"><ArrowDownLeft className="h-3 w-3 text-blue-500" />{req.inbound}</span>
                          <span className="inline-flex items-center gap-0.5" title="Outbound"><ArrowUpRight className="h-3 w-3 text-green-500" />{req.outbound}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Client</span>
                        <div className="text-muted-foreground">{req.apiKey.name || "Unnamed"}</div>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Created</span>
                        <div className="text-muted-foreground">{timeAgo(req.createdAt)}</div>
                      </div>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Delivery Time</span>
                      <div className="text-muted-foreground">{deliveryTime(req.createdAt, req.deliveredAt)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className={thClass}>Ref Code</th>
                  <th className={thClass}>Status</th>
                  <th className={thClass}>Messages</th>
                  <th className={thClass}>Client</th>
                  <th className={thClass}>Created</th>
                  <th className={`${thClass} text-right`}>Delivery Time</th>
                  <th className={thClass}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((req) => {
                  const display = getDisplayStatus(req);
                  const canCancel =
                    req.status === "pending" || req.status === "active";
                  const canResend = ["responded", "expired", "closed"].includes(
                    req.status
                  );
                  const isLoading = actionLoading === req.id;

                  return (
                    <tr
                      key={req.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5">
                        <CopyableRefCode code={req.refCode} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                              statusStyles[display] || ""
                            }`}
                            title={
                              display === "delivered" && req.deliveredAt
                                ? `Delivered: ${new Date(req.deliveredAt).toLocaleString()}`
                                : undefined
                            }
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                dotStyles[display] || ""
                              }`}
                            />
                            {statusLabels[display] || req.status}
                          </span>
                          {req.requiresApproval && !req.approvalDecision && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                              Approval Required
                            </span>
                          )}
                          <PhoneCallBadge status={req.phoneCallStatus} />
                          <ClientTimeoutBadge timedOutAt={req.clientTimedOutAt} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-0.5" title="Inbound (consumer)"><ArrowDownLeft className="h-3 w-3 text-blue-500" />{req.inbound}</span>
                          <span className="inline-flex items-center gap-0.5" title="Outbound (provider)"><ArrowUpRight className="h-3 w-3 text-green-500" />{req.outbound}</span>
                        </div>
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
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {canCancel && (
                            <button onClick={() => handleCancel(req.id)} disabled={isLoading} title="Cancel"
                              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canResend && (
                            <button onClick={() => handleResend(req.id)} disabled={isLoading} title="Resend"
                              className="rounded p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors">
                              <RotateCcw className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
