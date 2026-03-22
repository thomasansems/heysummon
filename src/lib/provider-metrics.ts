/**
 * Provider metrics recalculation utility.
 *
 * Computes aggregate metrics (avg rating, response time, reliability)
 * from all help requests for a given provider. Fire-and-forget pattern.
 */

import { prisma } from "./prisma";

/**
 * Recalculate and persist provider metrics.
 *
 * Called after:
 * - Consumer rates a response (REQUEST_RATED)
 * - Request transitions to "responded" or "expired"
 *
 * Fire-and-forget — never throws, never blocks the calling request flow.
 */
export async function recalculateMetrics(providerId: string): Promise<void> {
  try {
    // Count responded requests
    const totalResponded = await prisma.helpRequest.count({
      where: { expertId: providerId, status: "responded" },
    });

    // Count also closed requests that were previously responded
    const totalRespondedAndClosed = await prisma.helpRequest.count({
      where: {
        expertId: providerId,
        status: "closed",
        respondedAt: { not: null },
      },
    });

    const responded = totalResponded + totalRespondedAndClosed;

    // Count expired requests
    const totalExpired = await prisma.helpRequest.count({
      where: { expertId: providerId, status: "expired" },
    });

    // Calculate reliability
    const total = responded + totalExpired;
    const reliability = total > 0 ? responded / total : null;

    // Calculate average rating (from rated requests only)
    const ratingAgg = await prisma.helpRequest.aggregate({
      where: {
        expertId: providerId,
        rating: { not: null },
      },
      _avg: { rating: true },
    });

    // Calculate average response time (from responded requests only)
    const responseTimeAgg = await prisma.helpRequest.aggregate({
      where: {
        expertId: providerId,
        responseTimeMs: { not: null },
      },
      _avg: { responseTimeMs: true },
    });

    // Upsert the metrics record
    await prisma.providerMetrics.upsert({
      where: { providerId },
      create: {
        providerId,
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
    console.error("[provider-metrics] Recalculation failed:", err);
  }
}
