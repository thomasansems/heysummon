export const runtime = "nodejs";

import { NextResponse } from "next/server";

/**
 * POST /api/v1/mercure-token — DEPRECATED
 *
 * Mercure is no longer directly accessible. Use GET /api/v1/events/stream instead.
 */
export async function POST() {
  return NextResponse.json(
    {
      error: "Deprecated",
      message:
        "Direct Mercure access is no longer available. Use GET /api/v1/events/stream with x-api-key header for SSE events.",
    },
    { status: 410 }
  );
}
