export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import jwt from "jsonwebtoken";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { validateProviderKey } from "@/lib/provider-key-auth";

const MERCURE_HUB_URL =
  process.env.MERCURE_HUB_URL || "http://localhost:3426/.well-known/mercure";
const MERCURE_JWT_SECRET = process.env.MERCURE_JWT_SECRET!;

/**
 * GET /api/v1/events/stream — SSE proxy for Mercure events
 *
 * Auth: x-api-key header (provider or client key)
 * Topics are automatically determined by key type:
 *   - Provider key → /heysummon/providers/{userId}
 *   - Client key   → all active request topics for that user
 *
 * Mercure is never exposed externally — this endpoint is the only way
 * for external clients to receive real-time events.
 */
export async function GET(request: NextRequest) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing x-api-key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Resolve topics from API key
  let topics: string[] = [];

  // Check provider key (with IP binding + device secret validation)
  const providerResult = await validateProviderKey(request);

  if (providerResult.ok) {
    topics = [`/heysummon/providers/${providerResult.provider.userId}`];
  } else if (providerResult.response.status === 403) {
    // Provider key recognized but IP/device blocked — return the error
    const body = await providerResult.response.json();
    return new Response(JSON.stringify(body), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  } else {
    // Not a provider key (401) — try client key
    // Check client key via enhanced validation (scope, IP, rate limit, rotation, device token)
    const authResult = await validateApiKeyRequest(request);
    if (!authResult.ok) {
      const res = authResult.response;
      const body = await res.json();
      return new Response(JSON.stringify(body), {
        status: res.status,
        headers: { "Content-Type": "application/json" },
      });
    }
    const clientKey = authResult.apiKey;

    const requests = await prisma.helpRequest.findMany({
      where: {
        apiKey: { userId: clientKey.userId },
        status: { notIn: ["closed", "expired"] },
      },
      select: { id: true },
    });

    topics = requests.map((r) => `/heysummon/requests/${r.id}`);

    if (topics.length === 0) {
      return new Response(JSON.stringify({ error: "No active topics" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // Build Mercure subscriber JWT
  const subscriberToken = jwt.sign(
    { mercure: { subscribe: topics } },
    MERCURE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "24h" }
  );

  // Build Mercure SSE URL
  const params = new URLSearchParams();
  for (const t of topics) {
    params.append("topic", t);
  }
  const mercureUrl = `${MERCURE_HUB_URL}?${params.toString()}`;

  // Connect to Mercure internally and proxy events to the client
  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      // Send initial comment so the client knows we're connected
      controller.enqueue(
        encoder.encode(`: connected — listening on ${topics.length} topic(s)\n\n`)
      );

      try {
        const mercureRes = await fetch(mercureUrl, {
          headers: { Authorization: `Bearer ${subscriberToken}` },
          signal: abortController.signal,
        });

        if (!mercureRes.ok || !mercureRes.body) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: "upstream_connect_failed" })}\n\n`
            )
          );
          controller.close();
          return;
        }

        const reader = mercureRes.body.getReader();
        const _decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          // Forward raw SSE bytes from Mercure to client
          controller.enqueue(value);
        }

        controller.close();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Client disconnected — expected
        } else {
          console.error("SSE proxy error:", err);
          try {
            controller.enqueue(
              encoder.encode(
                `event: error\ndata: ${JSON.stringify({ error: "upstream_error" })}\n\n`
              )
            );
          } catch {
            // Controller may already be closed
          }
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
