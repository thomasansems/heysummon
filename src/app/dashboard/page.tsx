"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { X, ArrowDownLeft, ArrowUpRight, Clock, ShieldAlert, Check } from "lucide-react";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface DayActivity {
  day: string;
  current: number;
  previous: number;
  avgResponse: number;
}

interface RequestSummary {
  id: string;
  refCode: string | null;
  status: string;
  messageCount: number;
  inbound: number;
  outbound: number;
  createdAt: string;
  clientTimedOutAt: string | null;
  apiKey: { name: string | null };
}

interface PendingIpEvent {
  id: string;
  ip: string;
  attempts: number;
  lastSeen: string;
  clientName: string;
  apiKeyId: string;
}

interface Stats {
  total: number;
  open?: number;
  unhandled?: number;
  resolved?: number;
  expired?: number;
  missed?: number;
  avgResponseTime?: number;
  activity?: DayActivity[];
  topClients?: { name: string; count: number }[];
  openRequests?: RequestSummary[];
  unhandledRequests?: RequestSummary[];
  pendingIpEvents?: PendingIpEvent[];
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

function formatTime(seconds: number) {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

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
      className="font-mono text-xs text-foreground hover:text-primary cursor-pointer relative"
      title="Click to copy"
    >
      {code}
      {copied && (
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 rounded bg-foreground px-2 py-0.5 text-xs text-background whitespace-nowrap z-10">
          Copied!
        </span>
      )}
    </button>
  );
}

// CSS variable colors for recharts (resolved at render time)
const CHART_COLORS = [
  "hsl(35 55% 68%)",   // chart-1: peach
  "hsl(28 48% 52%)",   // chart-2: burnt orange
  "hsl(23 44% 42%)",   // chart-3: deeper
  "hsl(19 40% 34%)",   // chart-4: dark brown-orange
  "hsl(15 33% 26%)",   // chart-5: darkest
];

function CustomBarTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2.5 text-sm shadow-lg">
      <p className="mb-2 font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-xs font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

function CustomPieTooltip({ active, payload }: {
  active?: boolean;
  payload?: { name: string; value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{payload[0].name}</p>
      <p className="text-xs text-muted-foreground">{payload[0].value} requests</p>
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeClientIdx, setActiveClientIdx] = useState<number | null>(null);

  async function handleCancel(id: string) {
    setActionLoading(id);
    await fetch(`/api/v1/dashboard/requests/${id}/cancel`, { method: "POST" }).catch(() => null);
    setActionLoading(null);
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats).catch(() => null);
  }

  async function handleAllowIp(apiKeyId: string, eventId: string) {
    setActionLoading(eventId);
    await fetch(`/api/v1/keys/${apiKeyId}/ip-events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "allowed" }),
    }).catch(() => null);
    setActionLoading(null);
    fetch("/api/dashboard/stats").then((r) => r.json()).then(setStats).catch(() => null);
  }


  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-2xl font-semibold text-foreground">Overview</h1>
        {/* Stat card skeletons */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 animate-pulse">
              <div className="h-3 w-24 rounded bg-muted mb-3" />
              <div className="h-7 w-12 rounded bg-muted" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5 animate-pulse">
            <div className="h-4 w-40 rounded bg-muted mb-2" />
            <div className="h-3 w-32 rounded bg-muted mb-6" />
            <div className="h-48 w-full rounded bg-muted" />
          </div>
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5 animate-pulse">
            <div className="h-4 w-32 rounded bg-muted mb-2" />
            <div className="h-3 w-24 rounded bg-muted mb-6" />
            <div className="h-32 w-32 rounded-full bg-muted mx-auto" />
          </div>
        </div>
        {/* Open requests skeleton */}
        <div className="rounded-xl border border-border bg-card p-4 animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
          <div className="h-10 w-full rounded bg-muted" />
        </div>
      </div>
    );
  }

  // Normalize — guard against partial/missing fields from API
  const openRequests = stats.openRequests ?? [];
  const unhandledRequests = stats.unhandledRequests ?? [];
  const pendingIpEvents = stats.pendingIpEvents ?? [];
  const activity = stats.activity ?? [];

  const totalThisWeek = activity.reduce((s, d) => s + d.current, 0);
  const totalPrevWeek = activity.reduce((s, d) => s + d.previous, 0);
  const deltaPct = totalPrevWeek > 0
    ? Math.round(((totalThisWeek - totalPrevWeek) / totalPrevWeek) * 100)
    : null;
  const deltaStr = deltaPct === null ? "—" : deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`;

  const topClients = stats.topClients ?? [];
  const totalClients = topClients.reduce((s, c) => s + c.count, 0);

  const highlighted = activeClientIdx !== null ? topClients[activeClientIdx] : null;
  const highlightedPct = highlighted && totalClients > 0
    ? Math.round((highlighted.count / totalClients) * 100)
    : null;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-2xl font-semibold text-foreground">Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
        {[
          { label: "Total Requests", value: stats.total ?? 0 },
          { label: "Open", value: stats.open ?? 0 },
          { label: "Unhandled", value: stats.unhandled ?? 0 },
          { label: "Resolved", value: stats.resolved ?? 0 },
          { label: "Missed", value: stats.missed ?? 0 },
          { label: "Avg Response", value: formatTime(stats.avgResponseTime ?? 0) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</p>
            <p className="mt-1.5 text-2xl font-semibold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">

        {/* Traffic Channels-style bar chart — 3/5 */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card p-5">
          <div className="mb-4">
            <h2 className="font-serif text-base font-semibold text-foreground">Requests per day</h2>
            <p className="text-sm text-muted-foreground">This week vs. last week</p>
          </div>

          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} barGap={4} barCategoryGap="20%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide allowDecimals={false} />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                <Bar dataKey="current" name="This week" fill={CHART_COLORS[0]} radius={[8, 8, 0, 0]} maxBarSize={40} />
                <Bar dataKey="previous" name="Last week" fill={CHART_COLORS[1]} radius={[8, 8, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="mt-3 flex items-center justify-center gap-5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[0] }} />
              This week
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[1] }} />
              Last week
            </span>
          </div>

          {/* Summary stats */}
          <div className="mt-4 grid grid-cols-3 divide-x divide-border border-t border-border pt-4">
            <div className="px-3 text-center first:pl-0 last:pr-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">This week</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{totalThisWeek}</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Last week</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{totalPrevWeek}</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Delta</p>
              <p className={`mt-0.5 text-xl font-bold ${deltaPct !== null && deltaPct >= 0 ? "text-primary" : "text-muted-foreground"}`}>
                {deltaStr}
              </p>
            </div>
          </div>
        </div>

        {/* Top 5 clients donut chart — 2/5 */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
          <div className="mb-2">
            <h2 className="font-serif text-base font-semibold text-foreground">Top Clients</h2>
            <p className="text-sm text-muted-foreground">Most active — all time</p>
          </div>

          {(topClients ?? []).length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              No requests yet
            </div>
          ) : (
            <>
              {/* Donut */}
              <div className="relative flex items-center justify-center" style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topClients}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                      onMouseEnter={(_, idx) => setActiveClientIdx(idx)}
                      onMouseLeave={() => setActiveClientIdx(null)}
                    >
                      {topClients.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                          opacity={activeClientIdx === null || activeClientIdx === i ? 1 : 0.5}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomPieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center label */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-foreground">
                    {highlighted ? highlighted.count : totalClients}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {highlighted ? "requests" : "total"}
                  </span>
                </div>
              </div>

              {/* Legend */}
              <div className="mt-2 space-y-1.5">
                {topClients.map((client, i) => {
                  const pct = totalClients > 0 ? Math.round((client.count / totalClients) * 100) : 0;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                        style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                      <span className="flex-1 truncate text-xs text-muted-foreground">{client.name}</span>
                      <span className="text-xs font-medium text-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>

              {/* Highlighted client bar */}
              {highlighted && (
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground truncate">{highlighted.name}</span>
                    <span>{highlightedPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
                    <div
                      className="h-1 rounded-full transition-all"
                      style={{
                        width: `${highlightedPct}%`,
                        background: CHART_COLORS[activeClientIdx! % CHART_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Pending IP Approvals */}
      {pendingIpEvents.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              New IP Addresses
            </span>
            <span className="ml-2 inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
              {pendingIpEvents.length}
            </span>
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            These IP addresses tried to connect but are not yet allowed. Allow them to let requests through.
          </p>
          <div className="overflow-x-auto rounded-xl border border-amber-500/20 bg-card">
            {/* Mobile */}
            <div className="md:hidden">
              {pendingIpEvents.map((evt) => (
                <div key={evt.id} className="border-b border-border p-4 space-y-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-foreground">{evt.ip}</span>
                    <button
                      onClick={() => handleAllowIp(evt.apiKeyId, evt.id)}
                      disabled={actionLoading === evt.id}
                      className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-3 w-3" />Allow
                    </button>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{evt.clientName}</span>
                    <span>{evt.attempts} attempt{evt.attempts !== 1 ? "s" : ""}</span>
                    <span>{timeAgo(evt.lastSeen)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">IP Address</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Last Seen</th>
                  <th className="px-4 py-3 font-medium w-24" />
                </tr>
              </thead>
              <tbody>
                {pendingIpEvents.map((evt) => (
                  <tr key={evt.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-mono text-foreground">{evt.ip}</td>
                    <td className="px-4 py-3 text-muted-foreground">{evt.clientName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{evt.attempts}</td>
                    <td className="px-4 py-3 text-muted-foreground">{timeAgo(evt.lastSeen)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleAllowIp(evt.apiKeyId, evt.id)}
                        disabled={actionLoading === evt.id}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        <Check className="h-3 w-3" />Allow
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Open Requests */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Open Requests
          {(stats.open ?? 0) > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
              {stats.open ?? 0}
            </span>
          )}
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          {openRequests.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No open requests
            </div>
          ) : (
            <>
              {/* Mobile */}
              <div className="md:hidden">
                {openRequests.map((req) => {
                  const isLoading = actionLoading === req.id;
                  const canCancel = req.status === "pending" || req.status === "active";
                  return (
                    <div key={req.id} className="border-b border-border p-4 space-y-2 last:border-0 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <CopyableRefCode code={req.refCode} />
                        <div className="flex items-center gap-1">
                          {canCancel && (
                            <button onClick={() => handleCancel(req.id)} disabled={isLoading} title="Cancel"
                              className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <span className="text-xs text-muted-foreground ml-1">{timeAgo(req.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{req.apiKey.name || "Unnamed"}</span>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          req.status === "active" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300"
                        }`}>{req.status === "active" ? "Active" : "Pending"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Ref</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Messages</th>
                    <th className="px-4 py-3 font-medium text-right">Time</th>
                    <th className="px-4 py-3 font-medium w-16" />
                  </tr>
                </thead>
                <tbody>
                  {openRequests.map((req) => {
                    const isLoading = actionLoading === req.id;
                    const canCancel = req.status === "pending" || req.status === "active";
                    return (
                      <tr key={req.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <CopyableRefCode code={req.refCode} />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {req.apiKey.name || "Unnamed"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            req.status === "active" ? "bg-teal-100 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300" : "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300"
                          }`}>{req.status === "active" ? "Active" : "Pending"}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-0.5" title="Inbound (consumer)"><ArrowDownLeft className="h-3 w-3 text-blue-500" />{req.inbound}</span>
                            <span className="inline-flex items-center gap-0.5" title="Outbound (expert)"><ArrowUpRight className="h-3 w-3 text-green-500" />{req.outbound}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                          {timeAgo(req.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canCancel && (
                              <button onClick={() => handleCancel(req.id)} disabled={isLoading} title="Cancel"
                                className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 transition-colors">
                                <X className="h-3.5 w-3.5" />
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

      {/* Unhandled Requests — client timed out, expert never responded */}
      {unhandledRequests.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Unhandled Requests
            <span className="ml-2 inline-flex items-center rounded-full bg-orange-500/15 px-2 py-0.5 text-xs font-medium text-orange-600 dark:text-orange-400">
              {stats.unhandled ?? 0}
            </span>
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Requests where the client timed out waiting for a response. These will not be handled anymore.
          </p>
          <div className="overflow-x-auto rounded-xl border border-orange-500/20 bg-card">
            {/* Mobile */}
            <div className="md:hidden">
              {unhandledRequests.map((req) => (
                <div key={req.id} className="border-b border-border p-4 space-y-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <CopyableRefCode code={req.refCode} />
                    <span className="text-xs text-muted-foreground">{timeAgo(req.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{req.apiKey.name || "Unnamed"}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 px-2 py-0.5 text-xs font-medium">
                      <Clock className="h-3 w-3" />Unhandled
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <table className="hidden md:table w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Ref</th>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Timed Out</th>
                  <th className="px-4 py-3 font-medium text-right">Created</th>
                </tr>
              </thead>
              <tbody>
                {unhandledRequests.map((req) => (
                  <tr key={req.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <CopyableRefCode code={req.refCode} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {req.apiKey.name || "Unnamed"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {req.clientTimedOutAt ? timeAgo(req.clientTimedOutAt) : "---"}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground whitespace-nowrap">
                      {timeAgo(req.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
