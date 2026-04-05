import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * POST — Start monitoring for an incoming E2E test request from the client.
 *        Returns a timestamp to filter requests created after this point.
 * GET  — Poll for the latest HelpRequest from this apiKey, returning its stage.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { apiKeyId } = await request.json();
  if (!apiKeyId) {
    return NextResponse.json({ error: "apiKeyId is required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: apiKeyId, userId: user.id },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  return NextResponse.json({
    monitoringSince: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const apiKeyId = searchParams.get("apiKeyId");
  const since = searchParams.get("since");

  if (!apiKeyId || !since) {
    return NextResponse.json(
      { error: "apiKeyId and since are required" },
      { status: 400 }
    );
  }

  // Find the most recent HelpRequest from this client key created after monitoring started
  const helpRequest = await prisma.helpRequest.findFirst({
    where: {
      apiKeyId,
      expertId: user.id,
      createdAt: { gte: new Date(since) },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      refCode: true,
      status: true,
      requiresApproval: true,
      approvalDecision: true,
      notifiedExpertAt: true,
      respondedAt: true,
      consumerDeliveredAt: true,
      createdAt: true,
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ stage: "waiting" });
  }

  // Determine the current stage of the E2E flow
  let stage: string;
  if (helpRequest.consumerDeliveredAt) {
    stage = "delivered";
  } else if (helpRequest.respondedAt || helpRequest.approvalDecision) {
    stage = "responded";
  } else if (helpRequest.notifiedExpertAt) {
    stage = "notified";
  } else {
    stage = "received";
  }

  return NextResponse.json({
    stage,
    requestId: helpRequest.id,
    refCode: helpRequest.refCode,
    status: helpRequest.status,
    requiresApproval: helpRequest.requiresApproval,
    approvalDecision: helpRequest.approvalDecision,
    notifiedAt: helpRequest.notifiedExpertAt?.toISOString() ?? null,
    respondedAt: helpRequest.respondedAt?.toISOString() ?? null,
    deliveredAt: helpRequest.consumerDeliveredAt?.toISOString() ?? null,
  });
}
