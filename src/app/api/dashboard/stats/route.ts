import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const [total, open, resolvedCount, expiredCount, recentRequests, prevRequests, topClientsRaw] = await Promise.all([
    prisma.helpRequest.count({ where: { expertId: userId } }),
    prisma.helpRequest.count({ where: { expertId: userId, status: "pending" } }),
    prisma.helpRequest.count({ where: { expertId: userId, status: "resolved" } }),
    prisma.helpRequest.count({ where: { expertId: userId, status: "expired" } }),
    // Last 7 days
    prisma.helpRequest.findMany({
      where: { expertId: userId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, deliveredAt: true, status: true },
    }),
    // Previous 7 days (for comparison)
    prisma.helpRequest.findMany({
      where: { expertId: userId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      select: { createdAt: true, deliveredAt: true },
    }),
    // Top 5 clients by request count (all time)
    prisma.helpRequest.groupBy({
      by: ["apiKeyId"],
      where: { expertId: userId, apiKeyId: { not: undefined } },
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

  // Open requests with message preview
  const openRequests = await prisma.helpRequest.findMany({
    where: { expertId: userId, status: "pending" },
    select: {
      id: true,
      refCode: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      question: true,
      apiKey: { select: { name: true } },
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const mappedOpenRequests = openRequests.map((r) => ({
    id: r.id,
    refCode: r.refCode,
    status: r.status,
    messageCount: r._count.messageHistory,
    deliveredAt: r.deliveredAt,
    createdAt: r.createdAt,
    question: r.question,
    apiKey: r.apiKey,
  }));

  return NextResponse.json({
    total,
    open,
    resolved: resolvedCount,
    expired: expiredCount,
    avgResponseTime,
    activity,
    activityArr: activity.map((a) => a.current),
    topClients,
    openRequests: mappedOpenRequests,
  });
}
