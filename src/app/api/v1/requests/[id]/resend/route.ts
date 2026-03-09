import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/**
 * POST /api/requests/:id/resend — Re-publish a Mercure notification for a request.
 *
 * Used when the provider watcher missed the original SSE event.
 * Auth: session cookie (dashboard user).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const helpRequest = await prisma.helpRequest.findFirst({
    where: { id, expertId: user.id },
    select: {
      id: true,
      refCode: true,
      status: true,
      question: true,
      createdAt: true,
      expiresAt: true,
      consumerSignPubKey: true,
      consumerEncryptPubKey: true,
      messageHistory: {
        select: { id: true },
      },
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (helpRequest.status === "closed" || helpRequest.status === "expired") {
    return NextResponse.json(
      { error: "Cannot resend notification for closed/expired requests" },
      { status: 400 }
    );
  }

  try {

    // Reset deliveredAt so we can track the new delivery
    await prisma.helpRequest.update({
      where: { id },
      data: { deliveredAt: null },
    });

    logAuditEvent({
      eventType: AuditEventTypes.NOTIFICATION_RESENT,
      userId: user.id,
      success: true,
      metadata: { requestId: id, refCode: helpRequest.refCode },
      request,
    });

    return NextResponse.json({ ok: true, message: "Notification resent" });
  } catch {
    return NextResponse.json(
      { error: "Failed to resend notification" },
      { status: 500 }
    );
  }
}
