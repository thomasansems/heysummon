"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalRequests: number;
  pending: number;
  responded: number;
  apiKeys: number;
}

export function StatsCards() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: "Total Requests", value: stats?.totalRequests ?? 0, color: "text-violet-400" },
    { label: "Pending", value: stats?.pending ?? 0, color: "text-yellow-400" },
    { label: "Responded", value: stats?.responded ?? 0, color: "text-green-400" },
    { label: "API Keys", value: stats?.apiKeys ?? 0, color: "text-blue-400" },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
        >
          <p className="text-sm text-zinc-400">{card.label}</p>
          <p className={`mt-1 text-3xl font-bold ${card.color}`}>
            {loading ? "–" : card.value}
          </p>
        </div>
      ))}
    </div>
  );
}
