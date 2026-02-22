/**
 * Analytics queries — Cloud-only feature.
 * Licensed under LICENSE_CLOUD.md.
 */

import { prisma } from "@/lib/prisma";

export interface OverviewMetrics {
  totalRequests: number;
  activeRequests: number;
  avgResponseTimeMs: number | null;
  requestsByStatus: { status: string; count: number }[];
  requestsPerDay: { date: string; count: number }[];
  peakHours: { hour: number; count: number }[];
}

export interface ProviderMetrics {
  providerId: string;
  providerName: string;
  totalRequests: number;
  avgResponseTimeMs: number | null;
  statusBreakdown: { status: string; count: number }[];
}

export interface RequestRow {
  id: string;
  refCode: string | null;
  status: string;
  createdAt: string;
  respondedAt: string | null;
  responseTimeMs: number | null;
  providerName: string;
}

/**
 * Get overview analytics for a given user (expert) and time range.
 */
export async function getOverview(
  userId: string,
  from: Date,
  to: Date,
): Promise<OverviewMetrics> {
  const where = {
    expertId: userId,
    createdAt: { gte: from, lte: to },
  };

  const [totalRequests, activeRequests, allRequests] = await Promise.all([
    prisma.helpRequest.count({ where }),
    prisma.helpRequest.count({ where: { ...where, status: "active" } }),
    prisma.helpRequest.findMany({
      where,
      select: {
        status: true,
        createdAt: true,
        respondedAt: true,
      },
    }),
  ]);

  // Avg response time (only for requests that have respondedAt)
  const responseTimes = allRequests
    .filter((r) => r.respondedAt)
    .map((r) => r.respondedAt!.getTime() - r.createdAt.getTime());
  const avgResponseTimeMs =
    responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;

  // Status breakdown
  const statusMap = new Map<string, number>();
  for (const r of allRequests) {
    statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
  }
  const requestsByStatus = Array.from(statusMap, ([status, count]) => ({ status, count }));

  // Requests per day
  const dayMap = new Map<string, number>();
  for (const r of allRequests) {
    const day = r.createdAt.toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }
  const requestsPerDay = Array.from(dayMap, ([date, count]) => ({ date, count })).sort(
    (a, b) => a.date.localeCompare(b.date),
  );

  // Peak hours
  const hourMap = new Map<number, number>();
  for (const r of allRequests) {
    const hour = r.createdAt.getUTCHours();
    hourMap.set(hour, (hourMap.get(hour) || 0) + 1);
  }
  const peakHours = Array.from(hourMap, ([hour, count]) => ({ hour, count })).sort(
    (a, b) => a.hour - b.hour,
  );

  return {
    totalRequests,
    activeRequests,
    avgResponseTimeMs,
    requestsByStatus,
    requestsPerDay,
    peakHours,
  };
}

/**
 * Provider leaderboard / breakdown.
 */
export async function getProviderMetrics(
  userId: string,
  from: Date,
  to: Date,
): Promise<ProviderMetrics[]> {
  const providers = await prisma.provider.findMany({
    where: { userId },
    select: { id: true, name: true },
  });

  const results: ProviderMetrics[] = [];

  for (const provider of providers) {
    const requests = await prisma.helpRequest.findMany({
      where: {
        expertId: userId,
        createdAt: { gte: from, lte: to },
        apiKey: { providerId: provider.id },
      },
      select: { status: true, createdAt: true, respondedAt: true },
    });

    const responseTimes = requests
      .filter((r) => r.respondedAt)
      .map((r) => r.respondedAt!.getTime() - r.createdAt.getTime());

    const statusMap = new Map<string, number>();
    for (const r of requests) {
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
    }

    results.push({
      providerId: provider.id,
      providerName: provider.name,
      totalRequests: requests.length,
      avgResponseTimeMs:
        responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : null,
      statusBreakdown: Array.from(statusMap, ([status, count]) => ({ status, count })),
    });
  }

  return results.sort((a, b) => b.totalRequests - a.totalRequests);
}

/**
 * Paginated request list with response time.
 */
export async function getRequestList(
  userId: string,
  from: Date,
  to: Date,
  page: number,
  pageSize: number,
): Promise<{ requests: RequestRow[]; total: number }> {
  const where = {
    expertId: userId,
    createdAt: { gte: from, lte: to },
  };

  const [total, rows] = await Promise.all([
    prisma.helpRequest.count({ where }),
    prisma.helpRequest.findMany({
      where,
      select: {
        id: true,
        refCode: true,
        status: true,
        createdAt: true,
        respondedAt: true,
        apiKey: {
          select: {
            provider: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const requests: RequestRow[] = rows.map((r) => ({
    id: r.id,
    refCode: r.refCode,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    respondedAt: r.respondedAt?.toISOString() ?? null,
    responseTimeMs: r.respondedAt
      ? r.respondedAt.getTime() - r.createdAt.getTime()
      : null,
    providerName: r.apiKey.provider?.name ?? "Unknown",
  }));

  return { requests, total };
}
