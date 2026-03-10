export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/events/pending — List pending events for providers or consumers
 *
 * Provider key (hs_prov_*): returns undelivered pending requests (new_request)
 * Client key (hs_cli_*):    returns requests with new provider messages (new_message)
 *
 * Auth: x-api-key (provider key or client key)
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
  }

  // Try provider key first (UserProfile)
  const provider = await prisma.userProfile.findFirst({
    where: { key: apiKey, isActive: true },
    select: { id: true, userId: true },
  });

  if (provider) {
    return handleProviderPending(provider);
  }

  // Try client key (ApiKey)
  const clientKey = await prisma.apiKey.findFirst({
    where: { key: apiKey, isActive: true },
    select: { id: true, userId: true },
  });

  if (clientKey) {
    return handleConsumerPending(clientKey);
  }

  return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
}

/** Provider: return undelivered pending requests */
async function handleProviderPending(provider: { id: string; userId: string }) {
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

/** Consumer: return requests that have new provider messages */
async function handleConsumerPending(clientKey: { id: string; userId: string }) {
  const requests = await prisma.helpRequest.findMany({
    where: {
      apiKeyId: clientKey.id,
      status: { in: ["pending", "active", "responded"] },
      expiresAt: { gt: new Date() },
      messageHistory: {
        some: { from: "provider" },
      },
    },
    select: {
      id: true,
      refCode: true,
      status: true,
      respondedAt: true,
      messageHistory: {
        where: { from: "provider" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true },
      },
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mapped = requests.map((r) => ({
    type: "new_message" as const,
    requestId: r.id,
    refCode: r.refCode,
    from: "provider" as const,
    messageCount: r._count.messageHistory,
    respondedAt: r.respondedAt?.toISOString() || null,
    latestMessageAt: r.messageHistory[0]?.createdAt.toISOString() || null,
  }));

  return NextResponse.json({ events: mapped });
}
