export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateProviderKey } from "@/lib/provider-key-auth";
import { decryptMessage } from "@/lib/crypto";

const DEBUG = process.env.DEBUG === "true";

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

  // Provider key — route through validateProviderKey for IP binding
  if (apiKey.startsWith("hs_prov_")) {
    const result = await validateProviderKey(request);
    if (!result.ok) return result.response;
    return handleProviderPending({ id: result.provider.id, userId: result.provider.userId });
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

/** Check if the current time falls within quiet hours for a provider */
function isInQuietHours(
  quietStart: string | null,
  quietEnd: string | null,
  timezone: string | null
): boolean {
  if (!quietStart || !quietEnd) return false;
  try {
    const tz = timezone || "UTC";
    // Get current time in provider's timezone as HH:MM
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: tz,
    });
    const parts = formatter.formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const current = `${h}:${m}`;

    // Compare HH:MM strings — handle overnight ranges (e.g. 22:00 → 08:00)
    if (quietStart <= quietEnd) {
      return current >= quietStart && current < quietEnd;
    } else {
      // Overnight: quiet from 22:00 until 08:00 next day
      return current >= quietStart || current < quietEnd;
    }
  } catch {
    return false;
  }
}

/** Provider: return undelivered pending requests */
async function handleProviderPending(provider: { id: string; userId: string }) {
  // Check quiet hours
  const profile = await prisma.userProfile.findUnique({
    where: { id: provider.id },
    select: { quietHoursStart: true, quietHoursEnd: true, timezone: true },
  });

  if (profile && isInQuietHours(profile.quietHoursStart, profile.quietHoursEnd, profile.timezone)) {
    // Provider is in quiet hours — return empty with hint to slow polling
    return NextResponse.json(
      { events: [], quietHours: true },
      { headers: { "Retry-After": "60" } }
    );
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
      questionPreview: true,
      serverPrivateKey: true,
      requiresApproval: true,
      approvalDecision: true,
      createdAt: true,
      expiresAt: true,
      consumerSignPubKey: true,
      consumerEncryptPubKey: true,
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const mapped = requests.map((r) => {
    // Resolve plaintext question: prefer questionPreview, then try server-side decrypt
    let questionPlaintext: string | null = r.questionPreview || null;
    if (!questionPlaintext && r.question && r.serverPrivateKey) {
      try {
        questionPlaintext = decryptMessage(r.question, r.serverPrivateKey);
      } catch {
        // Decryption failed — leave null
      }
    }

    return {
      type: "new_request" as const,
      requestId: r.id,
      refCode: r.refCode,
      question: questionPlaintext,
      requiresApproval: r.requiresApproval,
      approvalDecision: r.approvalDecision || null,
      messageCount: r._count.messageHistory,
      messagePreview: null,
      consumerSignPubKey: r.consumerSignPubKey || null,
      consumerEncryptPubKey: r.consumerEncryptPubKey || null,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
    };
  });

  if (DEBUG) {
    console.log("[GET /api/v1/events/pending] Provider poll:", {
      providerId: provider.id,
      eventCount: mapped.length,
      events: mapped.map((e) => ({
        requestId: e.requestId,
        refCode: e.refCode,
        requiresApproval: e.requiresApproval,
        question: e.question || null,
      })),
    });
  }

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

  if (DEBUG) {
    console.log("[GET /api/v1/events/pending] Consumer poll:", {
      clientKeyId: clientKey.id,
      eventCount: mapped.length,
      events: mapped.map((e) => ({
        requestId: e.requestId,
        refCode: e.refCode,
        latestMessageAt: e.latestMessageAt,
      })),
    });
  }

  return NextResponse.json({ events: mapped });
}
