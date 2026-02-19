"use client";

import { useEffect, useState } from "react";

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
    createdAt: string;
    apiKey: { name: string | null };
  }[];
}

function timeAgo(date: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
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

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex h-64 items-center justify-center text-[#666]">
        Loading...
      </div>
    );
  }

  const maxActivity = Math.max(...stats.activity, 1);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-black">Overview</h1>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Requests", value: stats.total },
          { label: "Open", value: stats.open },
          { label: "Resolved", value: stats.resolved },
          {
            label: "Avg Response",
            value: formatTime(stats.avgResponseTime),
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[#eaeaea] bg-white p-4"
          >
            <p className="text-sm text-[#666]">{stat.label}</p>
            <p className="mt-1 text-2xl font-semibold text-black">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Open Requests */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-medium text-black">Open Requests</h2>
        <div className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white">
          {stats.openRequests.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#666]">
              No open requests
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#eaeaea] text-left text-[#666]">
                  <th className="px-4 py-2.5 font-medium">Ref Code</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Client</th>
                  <th className="px-4 py-2.5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.openRequests.map((req) => (
                  <tr
                    key={req.id}
                    className="border-b border-[#eaeaea] last:border-0"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {req.refCode || "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-50 px-2 py-0.5 text-xs font-medium text-yellow-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                        Pending
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-[#666]">
                      {req.apiKey.name || "Unnamed"}
                    </td>
                    <td className="px-4 py-2.5 text-right text-[#666]">
                      {timeAgo(req.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Activity Chart */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-black">
          Activity (7 days)
        </h2>
        <div className="rounded-lg border border-[#eaeaea] bg-white p-4">
          <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
            {stats.activity.map((count, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-sm bg-violet-500 transition-all"
                  style={{
                    height: `${(count / maxActivity) * 100}%`,
                    minHeight: count > 0 ? 4 : 0,
                  }}
                />
                <span className="text-xs text-[#666]">
                  {DAYS[(new Date().getDay() + i - 5) % 7] || DAYS[i]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
