export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/events/pending — List undelivered pending requests
 *
 * Called by the provider watcher on (re)connect to catch missed events.
 * Returns requests where deliveredAt is null and status is pending/active.
 *
 * Auth: x-api-key (provider key)
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
  }

  const provider = await prisma.userProfile.findFirst({
    where: { key: apiKey, isActive: true },
    select: { id: true, userId: true },
  });

  if (!provider) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  const requests = await prisma.helpRequest.findMany({
    where: {
      expertId: provider.userId,
      deliveredAt: null,
      status: { in: ["pending", "active"] },
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      refCode: true,
      status: true,
      question: true,
      createdAt: true,
      expiresAt: true,
      consumerSignPubKey: true,
      consumerEncryptPubKey: true,
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mapped = requests.map((r) => ({
    type: "new_request" as const,
    requestId: r.id,
    refCode: r.refCode,
    question: r.question || null,
    messageCount: r._count.messageHistory,
    messagePreview: null,
    consumerSignPubKey: r.consumerSignPubKey || null,
    consumerEncryptPubKey: r.consumerEncryptPubKey || null,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
  }));

  return NextResponse.json({ events: mapped });
}
