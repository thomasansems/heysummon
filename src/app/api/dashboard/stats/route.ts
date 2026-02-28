import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const [total, open, requests] = await Promise.all([
    prisma.helpRequest.count({ where: { expertId: userId } }),
    prisma.helpRequest.count({
      where: { expertId: userId, status: "pending" },
    }),
    prisma.helpRequest.findMany({
      where: { expertId: userId, deliveredAt: { not: null } },
      select: { createdAt: true, deliveredAt: true },
    }),
  ]);

  let avgResponseTime = 0;
  if (requests.length > 0) {
    const totalMs = requests.reduce((sum, r) => {
      if (!r.deliveredAt) return sum;
      return sum + (r.deliveredAt.getTime() - r.createdAt.getTime());
    }, 0);
    avgResponseTime = Math.round(totalMs / requests.length / 1000);
  }

  // Activity for last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentRequests = await prisma.helpRequest.findMany({
    where: { expertId: userId, createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const activity: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    dayStart.setDate(dayStart.getDate() - i);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    activity.push(
      recentRequests.filter(
        (r) => r.createdAt >= dayStart && r.createdAt < dayEnd
      ).length
    );
  }

  // Open requests with message preview
  const openRequests = await prisma.helpRequest.findMany({
    where: { expertId: userId, status: "pending" },
    select: {
      id: true,
      refCode: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
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
    apiKey: r.apiKey,
  }));

  return NextResponse.json({
    total,
    open,
    delivered: requests.length,
    avgResponseTime,
    activity,
    openRequests: mappedOpenRequests,
  });
}
