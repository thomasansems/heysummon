export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/v1/events/ack/:requestId — Acknowledge delivery of a notification
 *
 * Called by the expert watcher after it successfully processes a pending event.
 * Updates deliveredAt on the HelpRequest and logs an audit event.
 *
 * Auth: x-api-key (expert key)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;
  const apiKey = request.headers.get("x-api-key");

  if (!apiKey) {
    return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
  }

  // Validate expert key OR client key
  let userId: string | null = null;
  let helpRequestFilter: Record<string, unknown> = { id: requestId };

  const expert = await prisma.userProfile.findFirst({
    where: { key: apiKey, isActive: true },
    select: { id: true, userId: true },
  });

  if (expert) {
    userId = expert.userId;
    helpRequestFilter.expertId = expert.userId;
  } else {
    // Try client key
    const clientKey = await prisma.apiKey.findFirst({
      where: { key: apiKey, isActive: true },
      select: { id: true, userId: true },
    });
    if (!clientKey) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }
    userId = clientKey.userId;
    helpRequestFilter.apiKeyId = clientKey.id;
  }

  // Find the request and verify ownership
  const helpRequest = await prisma.helpRequest.findFirst({
    where: helpRequestFilter,
    select: { id: true, refCode: true, deliveredAt: true, consumerDeliveredAt: true },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  const now = new Date();

  if (expert) {
    // Expert ACK: set deliveredAt (only once)
    if (!helpRequest.deliveredAt) {
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: { deliveredAt: now },
      });
    }
  } else {
    // Consumer ACK: always update consumerDeliveredAt so new messages can be detected
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { consumerDeliveredAt: now },
    });
  }

  logAuditEvent({
    eventType: AuditEventTypes.NOTIFICATION_DELIVERED,
    userId,
    success: true,
    metadata: {
      requestId,
      refCode: helpRequest.refCode,
      keyType: expert ? "expert" : "consumer",
    },
    request,
  });

  return NextResponse.json({ ok: true, deliveredAt: now.toISOString() });
}
