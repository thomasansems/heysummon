export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishToMercure } from "@/lib/mercure";

/**
 * POST /api/v1/close/:requestId — Close a conversation
 *
 * Either party (consumer or provider) can close the conversation.
 * Publishes a "closed" event to both Mercure topics.
 *
 * Returns: { success: true, closedAt }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    // Find the help request
    const helpRequest = await prisma.helpRequest.findUnique({
      where: { id: requestId },
    });

    if (!helpRequest) {
      return NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
    }

    if (helpRequest.status === "closed") {
      // Idempotent: already closed
      return NextResponse.json({
        success: true,
        status: "closed",
        closedAt: helpRequest.closedAt?.toISOString(),
      });
    }

    const closedAt = new Date();

    // Update status to closed
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        status: "closed",
        closedAt,
      },
    });

    // Publish to Mercure: notify both parties
    try {
      await Promise.all([
        // Notify consumer
        publishToMercure(
          `/heysummon/requests/${requestId}`,
          {
            type: 'closed',
            requestId,
            closedAt: closedAt.toISOString(),
          }
        ),
        // Notify provider
        publishToMercure(
          `/heysummon/providers/${helpRequest.expertId}`,
          {
            type: 'closed',
            requestId,
            refCode: helpRequest.refCode,
            closedAt: closedAt.toISOString(),
          }
        ),
      ]);
    } catch (mercureError) {
      console.error('Mercure publish failed (non-fatal):', mercureError);
    }

    return NextResponse.json({
      success: true,
      status: "closed",
      closedAt: closedAt.toISOString(),
    });
  } catch (err) {
    console.error("Close request error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
