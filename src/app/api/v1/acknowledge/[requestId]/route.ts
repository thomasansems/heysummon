export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import {
  acknowledgeNotification,
  type AcknowledgeSource,
} from "@/services/notifications/acknowledge";

/**
 * POST /api/v1/acknowledge/:requestId — Acknowledge a notification-mode request.
 *
 * Authentication (either):
 *   - Session cookie (dashboard ack button)
 *   - x-api-key header (expert or consumer key scoped to the request)
 *
 * Behavior:
 *   - 404 if the request is not found / not owned by the caller.
 *   - 409 NOT_APPLICABLE if the request expects a reply (use /close instead).
 *   - 200 idempotent success: sets status = "acknowledged" and acknowledgedAt.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params;

    let expertUserId: string | null = null;
    let source: AcknowledgeSource = "api";

    // 1. Try session (dashboard) first — avoids forcing the dashboard to
    //    round-trip through an API key header.
    const sessionUser = await getCurrentUser();
    if (sessionUser) {
      expertUserId = sessionUser.id;
      source = "dashboard";
    } else {
      // 2. Fall back to API key auth (mirror /close semantics).
      const authResult = await validateApiKeyRequest(request);
      if (!authResult.ok) return authResult.response;
      expertUserId = authResult.apiKey.userId;
    }

    if (!expertUserId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await acknowledgeNotification({
      requestId,
      expertUserId,
      source,
    });

    if (!result.ok) {
      if (result.code === "NOT_FOUND") {
        return NextResponse.json(
          { error: result.message },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: result.message, code: result.code },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      acknowledgedAt: result.acknowledgedAt.toISOString(),
    });
  } catch (err) {
    console.error("Acknowledge request error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
