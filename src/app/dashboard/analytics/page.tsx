"use client";

import { useEffect, useState, useCallback } from "react";

/* ── Types ── */
interface OverviewData {
  totalRequests: number;
  activeRequests: number;
  avgResponseTimeMs: number | null;
  requestsByStatus: { status: string; count: number }[];
  requestsPerDay: { date: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}

interface ProviderRow {
  providerId: string;
  providerName: string;
  totalRequests: number;
  avgResponseTimeMs: number | null;
}

/* ── Helpers ── */
function fmtMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  active: "#3b82f6",
  closed: "#10b981",
  expired: "#ef4444",
};

/* ── Bar Chart (CSS) ── */
function BarChart({
  data,
  labelKey,
  valueKey,
  color = "#000",
}: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1" style={{ height: 120 }}>
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] text-[#666]">{val}</span>
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(pct, 2)}%`,
                backgroundColor: color,
                minHeight: 2,
              }}
            />
            <span className="text-[10px] text-[#999] truncate max-w-full">
              {String(d[labelKey]).slice(-5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ── Card ── */
function Card({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-[#eaeaea] bg-white p-5 ${className}`}
    >
      <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-[#666]">
        {title}
      </h3>
      {children}
    </div>
  );
}

/* ── Page ── */
export default function AnalyticsPage() {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const from = new Date(Date.now() - days * 86400000)
      .toISOString()
      .slice(0, 10);
    const qs = `?from=${from}`;
    try {
      const [ovRes, provRes] = await Promise.all([
        fetch(`/api/v1/analytics/overview${qs}`),
        fetch(`/api/v1/analytics/providers${qs}`),
      ]);
      if (!ovRes.ok || !provRes.ok) {
        const body = await (ovRes.ok ? provRes : ovRes).json();
        throw new Error(body.error || "Failed to load analytics");
      }
      const [ovData, provData] = await Promise.all([
        ovRes.json(),
        provRes.json(),
      ]);
      setOverview(ovData);
      setProviders(provData.providers || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error === "Cloud-only feature") {
    return (
      <div className="text-center py-20 text-[#666]">
        <h2 className="text-lg font-semibold text-black mb-2">
          Analytics is a Cloud feature
        </h2>
        <p className="text-sm">
          Set <code className="bg-[#f5f5f5] px-1 rounded">HEYSUMMON_EDITION=cloud</code> to enable.
        </p>
      </div>
    );
  }

  if (loading && !overview) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-[#666]">
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-600 text-sm">{error}</div>
    );
  }

  if (!overview) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Analytics</h1>
        <div className="flex gap-1 rounded-lg border border-[#eaeaea] bg-white p-0.5">
          {(["7d", "30d", "90d"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-xs transition-colors ${
                range === r
                  ? "bg-black text-white"
                  : "text-[#666] hover:text-black"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card title="Total Requests">
          <p className="text-2xl font-bold">{overview.totalRequests}</p>
        </Card>
        <Card title="Active Now">
          <p className="text-2xl font-bold">{overview.activeRequests}</p>
        </Card>
        <Card title="Avg Response Time">
          <p className="text-2xl font-bold">
            {fmtMs(overview.avgResponseTimeMs)}
          </p>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <Card title="Requests per Day">
          {overview.requestsPerDay.length > 0 ? (
            <BarChart
              data={overview.requestsPerDay}
              labelKey="date"
              valueKey="count"
            />
          ) : (
            <p className="text-sm text-[#999]">No data</p>
          )}
        </Card>

        <Card title="Status Breakdown">
          <div className="space-y-2">
            {overview.requestsByStatus.map((s) => {
              const pct =
                overview.totalRequests > 0
                  ? (s.count / overview.totalRequests) * 100
                  : 0;
              return (
                <div key={s.status} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="capitalize">{s.status}</span>
                    <span className="text-[#666]">{s.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f5f5f5]">
                    <div
                      className="h-2 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          STATUS_COLORS[s.status] || "#888",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            {overview.requestsByStatus.length === 0 && (
              <p className="text-sm text-[#999]">No data</p>
            )}
          </div>
        </Card>
      </div>

      {/* Peak hours */}
      <Card title="Peak Hours (UTC)">
        {overview.peakHours.length > 0 ? (
          <BarChart
            data={overview.peakHours}
            labelKey="hour"
            valueKey="count"
            color="#3b82f6"
          />
        ) : (
          <p className="text-sm text-[#999]">No data</p>
        )}
      </Card>

      {/* Provider leaderboard */}
      <Card title="Provider Leaderboard">
        {providers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eaeaea] text-left text-xs text-[#999]">
                  <th className="pb-2 font-medium">Provider</th>
                  <th className="pb-2 font-medium text-right">Requests</th>
                  <th className="pb-2 font-medium text-right">
                    Avg Response
                  </th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr
                    key={p.providerId}
                    className="border-b border-[#f5f5f5]"
                  >
                    <td className="py-2">{p.providerName}</td>
                    <td className="py-2 text-right">{p.totalRequests}</td>
                    <td className="py-2 text-right text-[#666]">
                      {fmtMs(p.avgResponseTimeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#999]">No providers found</p>
        )}
      </Card>
    </div>
  );
}
