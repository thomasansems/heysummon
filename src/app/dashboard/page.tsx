"use client";

import { copyToClipboard } from "@/lib/clipboard";
import { useEffect, useState } from "react";
import { Inbox, CheckCircle2, Clock, TrendingUp, RefreshCw } from "lucide-react";

interface Stats {
  total: number;
  open: number;
  resolved: number;
  expired: number;
  avgResponseTime: number;
  activity: number[];
  openRequests: {
    id: string;
    refCode: string | null;
    status: string;
    question: string | null;
    messageCount: number;
    createdAt: string;
    apiKey: { name: string | null };
  }[];
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
  return `${m}m ${s}s`;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CopyableRefCode({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-muted-foreground">—</span>;
  return (
    <button
      className="relative font-mono text-xs text-foreground hover:text-primary transition-colors"
      onClick={async () => {
        await copyToClipboard(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
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

const statCards = (s: Stats) => [
  {
    label: "Total requests",
    value: s.total,
    icon: TrendingUp,
    color: "text-blue-500",
    bg: "bg-blue-500/8",
  },
  {
    label: "Open",
    value: s.open,
    icon: Inbox,
    color: "text-amber-500",
    bg: "bg-amber-500/8",
  },
  {
    label: "Resolved",
    value: s.resolved,
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500/8",
  },
  {
    label: "Avg response",
    value: formatTime(s.avgResponseTime),
    icon: Clock,
    color: "text-violet-500",
    bg: "bg-violet-500/8",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = () => {
    setRefreshing(true);
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  const maxActivity = Math.max(...stats.activity, 1);

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Overview</h1>
          <p className="text-sm text-muted-foreground">Your provider activity at a glance</p>
        </div>
        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards(stats).map((card) => (
          <div
            key={card.label}
            className="rounded-lg border border-border bg-card p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{card.label}</span>
              <div className={`flex h-6 w-6 items-center justify-center rounded-md ${card.bg}`}>
                <card.icon className={`h-3.5 w-3.5 ${card.color}`} />
              </div>
            </div>
            <p className="text-2xl font-semibold tabular-nums">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Open requests */}
        <div className="lg:col-span-2 rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium">Open Requests</h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
              {stats.open} pending
            </span>
          </div>
          {stats.openRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
              <p className="text-sm text-muted-foreground">All caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {stats.openRequests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors">
                  <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CopyableRefCode code={req.refCode} />
                      <span className="text-[10px] text-muted-foreground truncate">
                        {req.apiKey.name || "Unnamed"}
                      </span>
                    </div>
                    {req.question && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {req.question}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {timeAgo(req.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity chart */}
        <div className="rounded-lg border border-border bg-card">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-medium">Activity</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p>
          </div>
          <div className="p-4">
            <div className="flex items-end justify-between gap-1.5" style={{ height: 80 }}>
              {stats.activity.map((count, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-sm bg-primary/70 transition-all"
                    style={{
                      height: `${(count / maxActivity) * 100}%`,
                      minHeight: count > 0 ? 3 : 0,
                    }}
                  />
                  <span className="text-[9px] text-muted-foreground">
                    {DAYS[(new Date().getDay() + i - 5 + 7) % 7]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
