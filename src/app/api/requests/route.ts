import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requests = await prisma.helpRequest.findMany({
    where: { expertId: user.id },
    select: {
      id: true,
      refCode: true,
      status: true,
      question: true,
      createdAt: true,
      respondedAt: true,
      apiKey: { select: { name: true } },
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = requests.map((r) => ({
    id: r.id,
    refCode: r.refCode,
    status: r.status,
    question: r.question,
    messageCount: r._count.messageHistory,
    createdAt: r.createdAt,
    respondedAt: r.respondedAt,
    apiKey: r.apiKey,
  }));

  return NextResponse.json({ requests: mapped });
}
