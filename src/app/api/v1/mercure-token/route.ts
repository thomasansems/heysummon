export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSubscriberJWT } from "@/lib/mercure";

/**
 * POST /api/v1/mercure-token — Get a Mercure subscriber JWT
 *
 * Requires x-api-key header (provider or client key).
 * Returns a short-lived JWT scoped to the caller's topics:
 *   - Provider key → /heysummon/providers/{userId}
 *   - Client key   → /heysummon/requests/{requestId} (for specific request)
 *
 * Optional body: { requestId: string } to scope client token to a specific request
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json({ error: "Missing x-api-key" }, { status: 401 });
    }

    let body: { requestId?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is OK for providers
    }

    // Check if it's a provider key
    const provider = await prisma.provider.findFirst({
      where: { key: apiKey, isActive: true },
      select: { id: true, userId: true },
    });

    if (provider) {
      // Provider gets a token scoped to their provider topic
      const topics = [`/heysummon/providers/${provider.userId}`];
      const token = generateSubscriberJWT(topics);
      return NextResponse.json({
        token,
        topics,
        expiresIn: "24h",
      });
    }

    // Check if it's a client key
    const clientKey = await prisma.apiKey.findFirst({
      where: { key: apiKey, isActive: true },
      select: { id: true, userId: true },
    });

    if (clientKey) {
      // Client gets tokens scoped to their request topics
      const topics: string[] = [];

      if (body.requestId) {
        // Verify the request belongs to this client
        const helpRequest = await prisma.helpRequest.findFirst({
          where: {
            id: body.requestId,
            apiKey: { userId: clientKey.userId },
          },
        });
        if (helpRequest) {
          topics.push(`/heysummon/requests/${body.requestId}`);
        }
      } else {
        // Get all active requests for this client
        const requests = await prisma.helpRequest.findMany({
          where: {
            apiKey: { userId: clientKey.userId },
            status: { notIn: ["closed", "expired"] },
          },
          select: { id: true },
        });
        for (const req of requests) {
          topics.push(`/heysummon/requests/${req.id}`);
        }
      }

      if (topics.length === 0) {
        return NextResponse.json({ error: "No active topics" }, { status: 404 });
      }

      const token = generateSubscriberJWT(topics);
      return NextResponse.json({
        token,
        topics,
        expiresIn: "24h",
      });
    }

    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  } catch (err) {
    console.error("Mercure token error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
