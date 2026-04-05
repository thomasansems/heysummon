import { NextResponse } from "next/server";
import { getCurrentUser, generateApiKey } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const experts = await prisma.userProfile.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      name: true,
      key: true,
      isActive: true,
      createdAt: true,
      timezone: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      availableDays: true,
      phoneFirst: true,
      phoneFirstIntegrationId: true,
      phoneFirstTimeout: true,
      _count: { select: { apiKeys: true } },
      ipEvents: { orderBy: { lastSeen: "desc" } },
      expertChannels: {
        select: { id: true, type: true, name: true, status: true, config: true },
        orderBy: { createdAt: "asc" },
      },
      apiKeys: {
        where: { isActive: true },
        select: { id: true, name: true, clientChannel: true, clientSubChannel: true },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ experts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { name } = await request.json().catch(() => ({ name: null }));
  if (!name || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const expert = await prisma.userProfile.create({
    data: {
      name: name.trim(),
      key: generateApiKey("hs_exp_"),
      userId: user.id,
    },
  });

  return NextResponse.json({ expert });
}
