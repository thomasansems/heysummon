import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";
import { nonProbe } from "@/lib/help-request-scope";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // Get expert profile IDs for missed request count
  const expertProfiles = await prisma.userProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = expertProfiles.map((p) => p.id);

  const [total, open, resolvedCount, expiredCount, missedCount, recentRequests, prevRequests, topClientsRaw] = await Promise.all([
    prisma.helpRequest.count({ where: nonProbe({ expertId: userId }) }),
    prisma.helpRequest.count({ where: nonProbe({ expertId: userId, status: { in: ["pending", "active"] } }) }),
    prisma.helpRequest.count({ where: nonProbe({ expertId: userId, status: "responded" }) }),
    prisma.helpRequest.count({ where: nonProbe({ expertId: userId, status: "expired" }) }),
    profileIds.length > 0
      ? prisma.missedRequest.count({ where: { expertId: { in: profileIds } } })
      : 0,
    // Last 7 days
    prisma.helpRequest.findMany({
      where: nonProbe({ expertId: userId, createdAt: { gte: sevenDaysAgo } }),
      select: { createdAt: true, deliveredAt: true, status: true },
    }),
    // Previous 7 days (for comparison)
    prisma.helpRequest.findMany({
      where: nonProbe({ expertId: userId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } }),
      select: { createdAt: true, deliveredAt: true },
    }),
    // Top 5 clients by request count (all time)
    prisma.helpRequest.groupBy({
      by: ["apiKeyId"],
      where: nonProbe({ expertId: userId, apiKeyId: { not: undefined } }),
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    }),
  ]);

  // Activity last 7 days + prev 7 days per day
  const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const activity: { day: string; current: number; previous: number; avgResponse: number }[] = [];

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const prevDayStart = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const prevDayEnd = new Date(dayEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    const currentDayReqs = recentRequests.filter(
      (r) => r.createdAt >= dayStart && r.createdAt < dayEnd
    );
    const prevDayReqs = prevRequests.filter(
      (r) => r.createdAt >= prevDayStart && r.createdAt < prevDayEnd
    );

    // Avg response time for current day (ms → seconds)
    const responded = currentDayReqs.filter((r) => r.deliveredAt);
    const avgMs = responded.length
      ? responded.reduce((sum, r) => sum + (r.deliveredAt!.getTime() - r.createdAt.getTime()), 0) / responded.length
      : 0;

    const dayOfWeek = dayStart.getDay(); // 0=Sun
    const dayLabel = DAYS[dayOfWeek === 0 ? 6 : dayOfWeek - 1];

    activity.push({
      day: dayLabel,
      current: currentDayReqs.length,
      previous: prevDayReqs.length,
      avgResponse: Math.round(avgMs / 1000 / 60), // minutes
    });
  }

  // Overall avg response time (seconds)
  const allDelivered = recentRequests.filter((r) => r.deliveredAt);
  let avgResponseTime = 0;
  if (allDelivered.length > 0) {
    const totalMs = allDelivered.reduce(
      (sum, r) => sum + (r.deliveredAt!.getTime() - r.createdAt.getTime()),
      0
    );
    avgResponseTime = Math.round(totalMs / allDelivered.length / 1000);
  }

  // Resolve client names for top 5
  const topClientIds = topClientsRaw.map((r) => r.apiKeyId).filter(Boolean) as string[];
  const topClientKeys = topClientIds.length
    ? await prisma.apiKey.findMany({ where: { id: { in: topClientIds } }, select: { id: true, name: true } })
    : [];
  const clientNameMap = Object.fromEntries(topClientKeys.map((k) => [k.id, k.name || "Unnamed"]));
  const topClients = topClientsRaw.map((r) => ({
    name: clientNameMap[r.apiKeyId!] ?? "Unnamed",
    count: r._count.id,
  }));

  // Open requests with message preview + direction counts
  const allOpenRequests = await prisma.helpRequest.findMany({
    where: nonProbe({ expertId: userId, status: { in: ["pending", "active"] } }),
    select: {
      id: true,
      refCode: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      clientTimedOutAt: true,
      apiKey: { select: { name: true } },
      _count: { select: { messageHistory: true } },
      messageHistory: {
        select: { from: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapRequest = (r: typeof allOpenRequests[number]) => ({
    id: r.id,
    refCode: r.refCode,
    status: r.status,
    messageCount: r._count.messageHistory,
    inbound: r.messageHistory.filter((m) => m.from === "consumer").length,
    outbound: r.messageHistory.filter((m) => m.from === "expert").length,
    deliveredAt: r.deliveredAt,
    clientTimedOutAt: r.clientTimedOutAt,
    createdAt: r.createdAt,
    apiKey: r.apiKey,
  });

  // Split: truly open (client still waiting) vs unhandled (client timed out, never responded)
  const openRequests = allOpenRequests.filter((r) => !r.clientTimedOutAt).slice(0, 10).map(mapRequest);
  const unhandledRequests = allOpenRequests.filter((r) => r.clientTimedOutAt).slice(0, 10).map(mapRequest);

  // Pending IP events — new IPs that need approval
  const apiKeyIds = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true },
  });
  const pendingIpEvents = apiKeyIds.length > 0
    ? await prisma.ipEvent.findMany({
        where: {
          apiKeyId: { in: apiKeyIds.map((k) => k.id) },
          status: "pending",
        },
        select: {
          id: true,
          ip: true,
          attempts: true,
          lastSeen: true,
          apiKey: { select: { id: true, name: true } },
        },
        orderBy: { lastSeen: "desc" },
        take: 10,
      })
    : [];

  return NextResponse.json({
    total,
    open: openRequests.length,
    unhandled: unhandledRequests.length,
    resolved: resolvedCount,
    expired: expiredCount,
    missed: missedCount,
    avgResponseTime,
    activity,
    activityArr: activity.map((a) => a.current),
    topClients,
    openRequests,
    unhandledRequests,
    pendingIpEvents: pendingIpEvents.map((e) => ({
      id: e.id,
      ip: e.ip,
      attempts: e.attempts,
      lastSeen: e.lastSeen,
      clientName: e.apiKey?.name || "Unnamed",
      apiKeyId: e.apiKey?.id,
    })),
  });
}
