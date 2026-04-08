export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateExpertKey } from "@/lib/expert-key-auth";
import { decryptMessage } from "@/lib/crypto";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import { sendMessage, escapeTelegramMarkdown } from "@/lib/adapters/telegram";
import type { TelegramConfig } from "@/lib/adapters/types";

const DEBUG = process.env.DEBUG === "true";

/**
 * GET /api/v1/events/pending — List pending events for experts or consumers
 *
 * Expert key (hs_exp_*): returns undelivered pending requests (new_request)
 * Client key (hs_cli_*):  returns requests with new expert messages (new_message)
 *
 * Auth: x-api-key (expert key or client key)
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
  }

  // Expert key — route through validateExpertKey for IP binding
  if (apiKey.startsWith("hs_exp_")) {
    const result = await validateExpertKey(request);
    if (!result.ok) return result.response;
    return handleExpertPending({ id: result.expert.id, userId: result.expert.userId });
  }

  // Try client key (ApiKey)
  const clientKey = await prisma.apiKey.findFirst({
    where: { key: apiKey },
    select: { id: true, userId: true, lastPollAt: true, isActive: true },
  });

  if (!clientKey) {
    return NextResponse.json(
      { error: "API key not found", code: "KEY_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (!clientKey.isActive) {
    return NextResponse.json(
      { error: "API key has been deactivated", code: "KEY_DEACTIVATED" },
      { status: 403 }
    );
  }

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

/**
 * Check if the expert is currently within their availability window.
 * availableFrom/Until = HH:MM strings (the AVAILABLE period).
 * availableDays = comma-separated weekday numbers (0=Sun, 1=Mon … 6=Sat).
 * Returns true if expert is UNAVAILABLE (should back off).
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

    // Get current time + weekday in expert's timezone
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

/** Expert: return undelivered pending requests */
async function handleExpertPending(expert: { id: string; userId: string }) {
  // Check availability window
  const profile = await prisma.userProfile.findUnique({
    where: { id: expert.id },
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
      expertId: expert.userId,
      // Only return requests from clients linked to THIS specific expert
      apiKey: { expertId: expert.id },
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

  // Send deferred Telegram notifications for requests that were queued during unavailability
  sendDeferredNotifications(expert.id, requests).catch((err) => {
    console.error("[events/pending] Deferred notification failed:", err);
  });

  if (DEBUG) {
    console.log("[GET /api/v1/events/pending] Expert poll:", {
      expertId: expert.id,
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

/** Send Telegram notifications for requests that were deferred during expert unavailability */
async function sendDeferredNotifications(
  profileId: string,
  requests: Array<{ id: string; refCode: string | null; questionPreview: string | null; question: string | null; serverPrivateKey: string | null }>
) {
  // Find requests that haven't been notified yet
  const unnotified = await prisma.helpRequest.findMany({
    where: {
      id: { in: requests.map((r) => r.id) },
      notifiedExpertAt: null,
    },
    select: { id: true, refCode: true, questionPreview: true, apiKey: { select: { name: true } } },
  });

  if (unnotified.length === 0) return;

  // Find active Telegram channel for this expert
  const telegramChannel = await prisma.expertChannel.findFirst({
    where: { profileId, type: "telegram", isActive: true, status: "connected" },
  });
  if (!telegramChannel) {
    // No Telegram channel — just mark as notified (expert sees them via polling)
    await prisma.helpRequest.updateMany({
      where: { id: { in: unnotified.map((r) => r.id) } },
      data: { notifiedExpertAt: new Date() },
    });
    return;
  }

  const cfg = JSON.parse(telegramChannel.config) as TelegramConfig;
  if (!cfg.expertChatId || !cfg.botToken) return;

  for (const req of unnotified) {
    const clientName = escapeTelegramMarkdown(req.apiKey?.name || "Unknown client");
    const questionLine = req.questionPreview
      ? `\n"${escapeTelegramMarkdown(req.questionPreview.slice(0, 500))}${req.questionPreview.length > 500 ? "..." : ""}"\n`
      : "\n";
    const msg = [
      `*New help request* from ${clientName}`,
      questionLine,
      `Reply with:`,
      `\`/reply ${req.refCode} your answer\``,
    ].join("\n");

    await sendMessage(cfg.botToken, cfg.expertChatId, msg).catch((err) => {
      console.error(`[events/pending] Deferred Telegram notify failed for ${req.refCode}:`, err);
    });

    await prisma.helpRequest.update({
      where: { id: req.id },
      data: { notifiedExpertAt: new Date() },
    }).catch(() => {});
  }
}

/** Consumer: return requests that have new expert messages or direct phone responses */
async function handleConsumerPending(clientKey: { id: string; userId: string }) {
  // Fire-and-forget heartbeat — enables connection verification without blocking the response
  prisma.apiKey.update({
    where: { id: clientKey.id },
    data: { lastPollAt: new Date() },
  }).catch(() => {});

  const requests = await prisma.helpRequest.findMany({
    where: {
      apiKeyId: clientKey.id,
      expiresAt: { gt: new Date() },
      OR: [
        // Message-based responses (via chat channels)
        {
          status: { in: ["pending", "active", "responded"] },
          messageHistory: { some: { from: "expert" } },
        },
        // Direct responses (via phone/Twilio) — no messageHistory entry
        {
          status: "responded",
          response: { not: null },
        },
      ],
    },
    select: {
      id: true,
      refCode: true,
      status: true,
      respondedAt: true,
      consumerDeliveredAt: true,
      messageHistory: {
        where: { from: "expert" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, createdAt: true },
      },
      _count: { select: { messageHistory: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Only include requests with new data since the consumer's last ACK
  const filtered = requests.filter((r) => {
    const latestMsg = r.messageHistory[0];

    // Direct phone response without message history
    if (!latestMsg) {
      if (r.status !== "responded") return false;
      if (!r.consumerDeliveredAt) return true; // never ACKed — show it
      return !!r.respondedAt && r.respondedAt > r.consumerDeliveredAt;
    }

    // Message-based response
    if (!r.consumerDeliveredAt) return true; // never ACKed — show it
    return latestMsg.createdAt > r.consumerDeliveredAt; // new message since last ACK
  });

  const mapped = filtered.map((r) => ({
    type: "new_message" as const,
    requestId: r.id,
    refCode: r.refCode,
    from: "expert" as const,
    messageCount: r._count.messageHistory,
    respondedAt: r.respondedAt?.toISOString() || null,
    latestMessageAt: r.messageHistory[0]?.createdAt.toISOString() || r.respondedAt?.toISOString() || null,
  }));

  // Fetch cancelled requests not yet acknowledged by the consumer
  const cancelledRequests = await prisma.helpRequest.findMany({
    where: {
      apiKeyId: clientKey.id,
      status: "cancelled",
      closedAt: { not: null },
    },
    select: {
      id: true,
      refCode: true,
      closedAt: true,
      consumerDeliveredAt: true,
    },
    orderBy: { closedAt: "desc" },
    take: 20,
  });

  const cancelledMapped = cancelledRequests
    .filter((r) => {
      if (!r.closedAt) return false;
      if (!r.consumerDeliveredAt) return true; // never ACKed
      return r.closedAt > r.consumerDeliveredAt; // cancelled after last ACK
    })
    .map((r) => ({
      type: "cancelled" as const,
      requestId: r.id,
      refCode: r.refCode,
      cancelledAt: r.closedAt!.toISOString(),
    }));

  const allEvents = [...mapped, ...cancelledMapped];

  if (DEBUG) {
    console.log("[GET /api/v1/events/pending] Consumer poll:", {
      clientKeyId: clientKey.id,
      eventCount: allEvents.length,
      events: allEvents.map((e) => ({
        requestId: e.requestId,
        refCode: e.refCode,
        type: e.type,
      })),
    });
  }

  return NextResponse.json({ events: allEvents });
}
