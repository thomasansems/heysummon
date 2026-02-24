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
    LOGIN_SUCCESS: "bg-green-50 text-green-700",
    LOGIN_FAILURE: "bg-red-50 text-red-700",
    ACCOUNT_CREATED: "bg-blue-50 text-blue-700",
    API_KEY_CREATED: "bg-violet-50 text-violet-700",
    API_KEY_ROTATED: "bg-amber-50 text-amber-700",
    API_KEY_DELETED: "bg-red-50 text-red-700",
    KEY_EXCHANGE: "bg-cyan-50 text-cyan-700",
    PERMISSION_CHANGED: "bg-orange-50 text-orange-700",
    HELP_REQUEST_SUBMITTED: "bg-indigo-50 text-indigo-700",
    PROVIDER_RESPONSE: "bg-emerald-50 text-emerald-700",
  };

  const label = type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[type] || "bg-gray-50 text-gray-700"}`}>
      {label}
    </span>
  );
}

function SuccessBadge({ success }: { success: boolean }) {
  return success ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Success
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
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
        <h1 className="text-2xl font-semibold text-black">Audit Logs</h1>
        <label className="flex items-center gap-2 text-sm text-[#666]">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded border-[#eaeaea]"
          />
          Auto-refresh
        </label>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <select
          value={eventTypeFilter}
          onChange={(e) => setEventTypeFilter(e.target.value)}
          className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black"
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
          className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black"
          placeholder="Start date"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-[#eaeaea] bg-white px-3 py-1.5 text-sm text-black"
          placeholder="End date"
        />
        {(eventTypeFilter || startDate || endDate) && (
          <button
            onClick={() => {
              setEventTypeFilter("");
              setStartDate("");
              setEndDate("");
            }}
            className="rounded-md px-3 py-1.5 text-sm text-[#666] hover:text-black"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
        {loading ? (
          <div className="flex h-48 items-center justify-center text-sm text-[#666]">
            Loading...
          </div>
        ) : logs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-[#666]">
            No audit logs found
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eaeaea] text-left text-[#666]">
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
                      className="flex w-full items-center border-b border-[#eaeaea] text-left hover:bg-[#fafafa] transition-colors"
                    >
                      <span className="px-4 py-2.5 w-[160px] shrink-0 text-[#666]">
                        {formatDate(log.createdAt)}
                      </span>
                      <span className="px-4 py-2.5 w-[220px] shrink-0">
                        <EventTypeBadge type={log.eventType} />
                      </span>
                      <span className="px-4 py-2.5 flex-1 truncate text-black font-mono text-xs">
                        {log.userId || "—"}
                      </span>
                      <span className="px-4 py-2.5 w-[140px] shrink-0 text-[#666] font-mono text-xs">
                        {log.ip || "—"}
                      </span>
                      <span className="px-4 py-2.5 w-[100px] shrink-0 text-right">
                        <SuccessBadge success={log.success} />
                      </span>
                    </button>
                    {expandedId === log.id && (
                      <div className="border-b border-[#eaeaea] bg-[#fafafa] px-4 py-3">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-xs">
                          <div>
                            <span className="font-medium text-[#666]">Event ID:</span>{" "}
                            <span className="font-mono text-black">{log.id}</span>
                          </div>
                          <div>
                            <span className="font-medium text-[#666]">API Key ID:</span>{" "}
                            <span className="font-mono text-black">{log.apiKeyId || "—"}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="font-medium text-[#666]">User Agent:</span>{" "}
                            <span className="text-black break-all">{log.userAgent || "—"}</span>
                          </div>
                          {log.metadata && (
                            <div className="col-span-2">
                              <span className="font-medium text-[#666]">Metadata:</span>
                              <pre className="mt-1 overflow-x-auto rounded bg-white p-2 text-xs text-black border border-[#eaeaea]">
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
        )}
      </div>

      {/* Load more */}
      {hasMore && !loading && (
        <div className="mt-4 text-center">
          <button
            onClick={() => fetchLogs(nextCursor)}
            className="rounded-md border border-[#eaeaea] bg-white px-4 py-2 text-sm text-black hover:bg-[#fafafa] transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
