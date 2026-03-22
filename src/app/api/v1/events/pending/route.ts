export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateProviderKey } from "@/lib/provider-key-auth";
import { decryptMessage } from "@/lib/crypto";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

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
    select: { id: true, userId: true, lastPollAt: true },
  });

  if (clientKey) {
    // Log first-ever connection (when lastPollAt was null before this call)
    if (!clientKey.lastPollAt) {
      logAuditEvent({
        eventType: AuditEventTypes.CONSUMER_CONNECTED,
        userId: clientKey.userId,
        apiKeyId: clientKey.id,
        metadata: { firstConnection: true },
      }).catch(() => {});
    }
    return handleConsumerPending(clientKey);
  }

  return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
}

/**
 * Check if the provider is currently within their availability window.
 * availableFrom/Until = HH:MM strings (the AVAILABLE period).
 * availableDays = comma-separated weekday numbers (0=Sun, 1=Mon … 6=Sat).
 * Returns true if provider is UNAVAILABLE (should back off).
 */
function isUnavailable(
  availableFrom: string | null,
  availableUntil: string | null,
  availableDays: string | null,
  timezone: string | null
): boolean {
  if (!availableFrom && !availableUntil && !availableDays) return false;
  try {
    const tz = timezone || "UTC";
    const now = new Date();

    // Get current time + weekday in provider's timezone
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
    });
    const parts = timeFmt.formatToParts(now);
    const h = parts.find((p) => p.type === "hour")?.value ?? "00";
    const m = parts.find((p) => p.type === "minute")?.value ?? "00";
    const current = `${h}:${m}`;

    const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz });
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayMap[dayFmt.format(now)] ?? now.getDay();

    // Check weekday availability
    if (availableDays) {
      const days = availableDays.split(",").map((d) => parseInt(d.trim(), 10));
      if (!days.includes(currentDay)) return true; // Not an available day
    }

    // Check time availability
    if (availableFrom && availableUntil) {
      if (availableFrom <= availableUntil) {
        // Normal range e.g. 09:00 → 17:00
        if (current < availableFrom || current >= availableUntil) return true;
      } else {
        // Overnight range e.g. 22:00 → 06:00 (rare for availability but supported)
        if (current < availableFrom && current >= availableUntil) return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

/** Provider: return undelivered pending requests */
async function handleProviderPending(provider: { id: string; userId: string }) {
  // Check availability window
  const profile = await prisma.userProfile.findUnique({
    where: { id: provider.id },
    select: { quietHoursStart: true, quietHoursEnd: true, availableDays: true, timezone: true },
  });

  if (profile && isUnavailable(profile.quietHoursStart, profile.quietHoursEnd, profile.availableDays, profile.timezone)) {
    return NextResponse.json(
      { events: [], quietHours: true },
      { headers: { "Retry-After": "600" } }
    );
  }

  const requests = await prisma.helpRequest.findMany({
    where: {
      expertId: provider.userId,
      // Only return requests from clients linked to THIS specific provider
      apiKey: { providerId: provider.id },
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
      escalatedAt: true,
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
      escalated: !!r.escalatedAt,
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
  // Fire-and-forget heartbeat — enables connection verification without blocking the response
  prisma.apiKey.update({
    where: { id: clientKey.id },
    data: { lastPollAt: new Date() },
  }).catch(() => {});

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
