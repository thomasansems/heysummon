export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/v1/events/ack/:requestId — Acknowledge delivery of a notification
 *
 * Called by the provider watcher after it successfully processes an SSE event.
 * Updates deliveredAt on the HelpRequest and logs an audit event.
 *
 * Auth: x-api-key (provider key)
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

  // Validate provider key
  const provider = await prisma.userProfile.findFirst({
    where: { key: apiKey, isActive: true },
    select: { id: true, userId: true },
  });

  if (!provider) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Find the request and verify it belongs to this provider
  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      id: requestId,
      expertId: provider.userId,
    },
    select: { id: true, refCode: true, deliveredAt: true },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Only update if not already delivered
  if (!helpRequest.deliveredAt) {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { deliveredAt: new Date() },
    });

    logAuditEvent({
      eventType: AuditEventTypes.NOTIFICATION_DELIVERED,
      userId: provider.userId,
      success: true,
      metadata: {
        requestId,
        refCode: helpRequest.refCode,
      },
      request,
    });
  }

  return NextResponse.json({ ok: true, deliveredAt: new Date().toISOString() });
}
