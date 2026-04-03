/**
 * Expert metrics recalculation utility.
 *
 * Computes aggregate metrics (avg rating, response time, reliability)
 * from all help requests for a given expert. Fire-and-forget pattern.
 */

import { prisma } from "./prisma";

/**
 * Recalculate and persist expert metrics.
 *
 * Called after:
 * - Consumer rates a response (REQUEST_RATED)
 * - Request transitions to "responded" or "expired"
 *
 * Fire-and-forget — never throws, never blocks the calling request flow.
 */
export async function recalculateMetrics(expertId: string): Promise<void> {
  try {
    // Count responded requests
    const totalResponded = await prisma.helpRequest.count({
      where: { expertId, status: "responded" },
    });

    // Count also closed requests that were previously responded
    const totalRespondedAndClosed = await prisma.helpRequest.count({
      where: {
        expertId,
        status: "closed",
        respondedAt: { not: null },
      },
    });

    const responded = totalResponded + totalRespondedAndClosed;

    // Count expired requests
    const totalExpired = await prisma.helpRequest.count({
      where: { expertId, status: "expired" },
    });

    // Calculate reliability
    const total = responded + totalExpired;
    const reliability = total > 0 ? responded / total : null;

    // Calculate average rating (from rated requests only)
    const ratingAgg = await prisma.helpRequest.aggregate({
      where: {
        expertId,
        rating: { not: null },
      },
      _avg: { rating: true },
    });

    // Calculate average response time (from responded requests only)
    const responseTimeAgg = await prisma.helpRequest.aggregate({
      where: {
        expertId,
        responseTimeMs: { not: null },
      },
      _avg: { responseTimeMs: true },
    });

    // Upsert the metrics record
    await prisma.expertMetrics.upsert({
      where: { expertId },
      create: {
        expertId,
        avgRating: ratingAgg._avg.rating,
        avgResponseTimeMs: responseTimeAgg._avg.responseTimeMs,
        totalResponded: responded,
        totalExpired,
        reliability,
      },
      update: {
        avgRating: ratingAgg._avg.rating,
        avgResponseTimeMs: responseTimeAgg._avg.responseTimeMs,
        totalResponded: responded,
        totalExpired,
        reliability,
      },
    });
  } catch (err) {
    console.error("[expert-metrics] Recalculation failed:", err);
  }
}
