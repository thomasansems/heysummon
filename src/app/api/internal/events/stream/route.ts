export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth-config";
import jwt from "jsonwebtoken";

const MERCURE_HUB_URL =
  process.env.MERCURE_HUB_URL || "http://localhost:3100/.well-known/mercure";
const MERCURE_JWT_SECRET = process.env.MERCURE_JWT_SECRET!;

/**
 * GET /api/internal/events/stream — SSE proxy for dashboard (session auth)
 *
 * Topics are passed as query params and validated against the user's session.
 * Only topics belonging to the authenticated user are allowed.
 */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userId = session.user.id;
  const requestedTopics = request.nextUrl.searchParams.getAll("topic");

  if (requestedTopics.length === 0) {
    return new Response(JSON.stringify({ error: "No topics specified" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate all topics belong to this user
  const allowedPrefixes = [
    `/heysummon/providers/${userId}`,
    `/heysummon/requests/`,
  ];

  const topics = requestedTopics.filter((t) =>
    allowedPrefixes.some((prefix) => t.startsWith(prefix))
  );

  if (topics.length === 0) {
    return new Response(JSON.stringify({ error: "No authorized topics" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Build Mercure subscriber JWT
  const subscriberToken = jwt.sign(
    { mercure: { subscribe: topics } },
    MERCURE_JWT_SECRET,
    { algorithm: "HS256", expiresIn: "24h" }
  );

  const params = new URLSearchParams();
  for (const t of topics) {
    params.append("topic", t);
  }
  const mercureUrl = `${MERCURE_HUB_URL}?${params.toString()}`;

  const encoder = new TextEncoder();
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
        }

        controller.close();
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // Client disconnected
        } else {
          console.error("Internal SSE proxy error:", err);
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
