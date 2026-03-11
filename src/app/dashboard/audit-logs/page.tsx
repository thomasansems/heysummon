"use client";

import { useEffect, useState, useCallback, useRef } from "react";

interface AuditLogEntry {
  id: string;
  eventType: string;
  userId: string | null;
  apiKeyId: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  success: boolean;
  createdAt: string;
}

const EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILURE",
  "ACCOUNT_CREATED",
  "API_KEY_CREATED",
  "API_KEY_ROTATED",
  "API_KEY_DELETED",
  "KEY_EXCHANGE",
  "PERMISSION_CHANGED",
  "HELP_REQUEST_SUBMITTED",
  "NOTIFICATION_DELIVERED",
  "NOTIFICATION_RESENT",
  "PROVIDER_RESPONSE",
] as const;

function formatDate(date: string) {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    LOGIN_SUCCESS: "bg-green-950/60 text-green-300",
    LOGIN_FAILURE: "bg-red-950/60 text-red-300",
    ACCOUNT_CREATED: "bg-blue-950/60 text-blue-300",
    API_KEY_CREATED: "bg-violet-950/60 text-violet-300",
    API_KEY_ROTATED: "bg-amber-950/60 text-amber-300",
    API_KEY_DELETED: "bg-red-950/60 text-red-300",
    KEY_EXCHANGE: "bg-cyan-950/60 text-cyan-300",
    PERMISSION_CHANGED: "bg-orange-950/60 text-orange-300",
    HELP_REQUEST_SUBMITTED: "bg-indigo-950/60 text-indigo-300",
    NOTIFICATION_DELIVERED: "bg-emerald-950/60 text-emerald-300",
    NOTIFICATION_RESENT: "bg-amber-950/60 text-amber-300",
    PROVIDER_RESPONSE: "bg-emerald-950/60 text-emerald-300",
  };

  const label = type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function SuccessBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 px-2 py-0.5 text-xs font-medium text-emerald-300">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-950/60 px-2 py-0.5 text-xs font-medium text-red-300">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
      Failed
    </span>
  );
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(
    async (cursor?: string | null) => {
      const params = new URLSearchParams();
      if (eventTypeFilter) params.set("eventType", eventTypeFilter);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) params.set("endDate", new Date(endDate + "T23:59:59").toISOString());
      if (cursor) params.set("cursor", cursor);
      params.set("limit", "50");

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      if (cursor) {
        setLogs((prev) => [...prev, ...data.items]);
      } else {
        setLogs(data.items);
      }
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setLoading(false);
    },
    [eventTypeFilter, startDate, endDate]
  );

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => fetchLogs(), 10000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, fetchLogs]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Audit Logs</h1>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-border accent-primary [color-scheme:dark]"
          />
          Auto-refresh
        </label>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">All events</option>
          {EVENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          placeholder="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          placeholder="End date"
        />
        {(eventTypeFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setEventTypeFilter("");
              setStartDate("");
              setEndDate("");
            }}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No audit logs found
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="md:hidden">
              {logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  className="border-b border-border p-4 space-y-2 cursor-pointer hover:bg-muted transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{formatDate(log.createdAt)}</span>
                    <SuccessBadge success={log.success} />
                  </div>
                  <div><EventTypeBadge type={log.eventType} /></div>
                  <div>
                    <span className="text-xs text-muted-foreground">User</span>
                    <div className="font-mono text-xs text-foreground">{log.userId || "—"}</div>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">IP</span>
                    <div className="font-mono text-xs text-muted-foreground">{log.ip || "—"}</div>
                  </div>
                  {expandedId === log.id && (
                    <div className="mt-2 border-t border-border pt-2">
                      <div className="grid grid-cols-1 gap-y-2 text-xs">
                        <div>
                          <span className="font-medium text-muted-foreground">Event ID:</span>{" "}
                          <span className="font-mono text-foreground">{log.id}</span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">API Key ID:</span>{" "}
                          <span className="font-mono text-foreground">{log.apiKeyId || "—"}</span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">User Agent:</span>{" "}
                          <span className="text-foreground break-all">{log.userAgent || "—"}</span>
                        </div>
                        {log.metadata && (
                          <div>
                            <span className="font-medium text-muted-foreground">Metadata:</span>
                            <pre className="mt-1 overflow-x-auto rounded bg-card p-2 text-xs text-foreground border border-border">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop table view */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Timestamp</th>
                  <th className="px-4 py-2.5 font-medium">Event</th>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">IP</th>
                  <th className="px-4 py-2.5 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="group">
                    <td colSpan={5} className="p-0">
                      <button
                        onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                        className="flex w-full items-center border-b border-border text-left hover:bg-muted transition-colors"
                      >
                        <span className="px-4 py-2.5 w-[160px] shrink-0 text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </span>
                        <span className="px-4 py-2.5 w-[220px] shrink-0">
                          <EventTypeBadge type={log.eventType} />
                        </span>
                        <span className="px-4 py-2.5 flex-1 truncate text-foreground font-mono text-xs">
                          {log.userId || "—"}
                        </span>
                        <span className="px-4 py-2.5 w-[140px] shrink-0 text-muted-foreground font-mono text-xs">
                          {log.ip || "—"}
                        </span>
                        <span className="px-4 py-2.5 w-[100px] shrink-0 text-right">
                          <SuccessBadge success={log.success} />
                        </span>
                      </button>
                      {expandedId === log.id && (
                        <div className="border-b border-border bg-muted px-4 py-3">
                          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                            <div>
                              <span className="font-medium text-muted-foreground">Event ID:</span>{" "}
                              <span className="font-mono text-foreground">{log.id}</span>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">API Key ID:</span>{" "}
                              <span className="font-mono text-foreground">{log.apiKeyId || "—"}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium text-muted-foreground">User Agent:</span>{" "}
                              <span className="text-foreground break-all">{log.userAgent || "—"}</span>
                            </div>
                            {log.metadata && (
                              <div className="col-span-2">
                                <span className="font-medium text-muted-foreground">Metadata:</span>
                                <pre className="mt-1 overflow-x-auto rounded bg-card p-2 text-xs text-foreground border border-border">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchLogs(nextCursor)}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
