import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const statusFilter = request.nextUrl.searchParams.get("status") ?? undefined;

  // Support API key auth for provider polling (MCP-first skill watcher)
  const apiKey = request.headers.get("x-api-key");
  let userId: string | null = null;

  if (apiKey) {
    const profile = await prisma.userProfile.findFirst({
      where: { key: apiKey, isActive: true },
      select: { userId: true },
    });
    if (!profile) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    userId = profile.userId;
  } else {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    userId = user.id;
  }

  const where: Record<string, unknown> = { expertId: userId };
  if (statusFilter) {
    // DB stores lowercase status values (pending, active, closed, expired, responded)
    where.status = statusFilter.toLowerCase();
  }

  const requests = await prisma.helpRequest.findMany({
    where,
    select: {
      id: true,
      refCode: true,
      status: true,
      createdAt: true,
      deliveredAt: true,
      apiKey: { select: { name: true } },
      _count: { select: { messageHistory: true } },
      messageHistory: {
        where: { from: "provider" },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = requests.map((r) => ({
    id: r.id,
    refCode: r.refCode,
    status: r.status,
    messageCount: r._count.messageHistory,
    responseCount: r.messageHistory.length,
    createdAt: r.createdAt,
    deliveredAt: r.deliveredAt,
    apiKey: r.apiKey,
  }));

  return NextResponse.json({ requests: mapped });
}
