export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/v1/help/:requestId — Check request status.
 * Response is delivered via webhook, not here.
 * This endpoint only returns status + metadata.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      refCode: true,
      status: true,
      webhookDelivered: true,
      createdAt: true,
      respondedAt: true,
      expiresAt: true,
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Check if expired
  if (helpRequest.status === "pending" && new Date() > helpRequest.expiresAt) {
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: { status: "expired" },
    });
    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "expired",
    });
  }

  return NextResponse.json({
    requestId: helpRequest.id,
    refCode: helpRequest.refCode,
    status: helpRequest.status,
    webhookDelivered: helpRequest.webhookDelivered,
    createdAt: helpRequest.createdAt,
    respondedAt: helpRequest.respondedAt,
  });
}
