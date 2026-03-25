import { NextResponse } from "next/server";
import { auth } from "@/lib/auth-config";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Get provider profile IDs for this user
  const profiles = await prisma.userProfile.findMany({
    where: { userId },
    select: { id: true },
  });
  const profileIds = profiles.map((p) => p.id);

  if (profileIds.length === 0) {
    return NextResponse.json({ missedRequests: [], total: 0 });
  }

  const [missedRequests, total] = await Promise.all([
    prisma.missedRequest.findMany({
      where: { providerId: { in: profileIds } },
      select: {
        id: true,
        questionPreview: true,
        nextAvailableAt: true,
        createdAt: true,
        apiKey: { select: { name: true, clientChannel: true } },
        provider: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.missedRequest.count({
      where: { providerId: { in: profileIds } },
    }),
  ]);

  return NextResponse.json({
    missedRequests: missedRequests.map((m) => ({
      id: m.id,
      questionPreview: m.questionPreview,
      nextAvailableAt: m.nextAvailableAt,
      createdAt: m.createdAt,
      clientName: m.apiKey.name || "Unnamed",
      clientChannel: m.apiKey.clientChannel,
      providerName: m.provider.name,
    })),
    total,
  });
}
