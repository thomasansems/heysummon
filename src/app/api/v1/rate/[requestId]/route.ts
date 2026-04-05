export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { ratingCreateSchema, validateBody } from "@/lib/validations";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import { recalculateMetrics } from "@/lib/expert-metrics";

/**
 * POST /api/v1/rate/:requestId — Rate an expert's response
 *
 * Authentication: consumer API key (x-api-key header)
 * Body: { rating: 1-5, feedback?: string }
 *
 * Only allowed when request status is "responded" or "closed".
 * Idempotent: once rated, cannot re-rate (returns 409).
 *
 * Triggers async ExpertMetrics recalculation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    // Authenticate — consumer key only
    const authResult = await validateApiKeyRequest(request);
    if (!authResult.ok) return authResult.response;

    // Parse and validate body
    const raw = await request.json();
    const parsed = validateBody(ratingCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const { rating, feedback } = parsed.data;

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

    // Verify the consumer owns this request
    if (helpRequest.apiKeyId !== authResult.apiKey.id) {
      // Check if the userId matches instead (key may have been rotated)
      const ownerKey = await prisma.apiKey.findUnique({
        where: { id: helpRequest.apiKeyId },
        select: { userId: true },
      });
      if (!ownerKey || ownerKey.userId !== authResult.apiKey.userId) {
        return NextResponse.json(
          { error: "Not authorized to rate this request" },
          { status: 403 }
        );
      }
    }

    // Only allow rating on responded or closed requests
    if (helpRequest.status !== "responded" && helpRequest.status !== "closed") {
      return NextResponse.json(
        { error: `Cannot rate a request with status "${helpRequest.status}"` },
        { status: 400 }
      );
    }

    // Idempotent: once rated, cannot re-rate
    if (helpRequest.rating !== null) {
      return NextResponse.json(
        { error: "Request already rated", existingRating: helpRequest.rating },
        { status: 409 }
      );
    }

    // Store the rating
    const now = new Date();
    await prisma.helpRequest.update({
      where: { id: requestId },
      data: {
        rating,
        ratingFeedback: feedback ?? null,
        ratedAt: now,
      },
    });

    // Fire-and-forget: recalculate expert metrics
    recalculateMetrics(helpRequest.expertId);

    // Audit log
    logAuditEvent({
      eventType: AuditEventTypes.REQUEST_RATED,
      userId: authResult.apiKey.userId,
      apiKeyId: authResult.apiKey.id,
      success: true,
      metadata: {
        requestId,
        refCode: helpRequest.refCode,
        rating,
        hasFeedback: !!feedback,
      },
      request,
    });

    return NextResponse.json({
      success: true,
      rating,
      ratedAt: now.toISOString(),
    });
  } catch (err) {
    console.error("Rate request error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
