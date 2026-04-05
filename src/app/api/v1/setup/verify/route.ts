export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";

/** How recent a poll must be to count as "connected" (30 seconds) */
const ACTIVE_THRESHOLD_MS = 30_000;

/**
 * POST /api/v1/setup/verify
 *
 * Checks whether a consumer API key is currently actively polling.
 * Auth: Dashboard session (expert must be logged in — ensures only the key
 * owner can check connection status, not the consumer machine itself).
 *
 * Body: { keyId: string }
 * Response: { connected: boolean, lastPollAt: string | null, lastPollAgoMs: number | null, allowedIps: string[] }
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let keyId: string;
  try {
    const body = await request.json();
    keyId = body?.keyId;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!keyId || typeof keyId !== "string") {
    return NextResponse.json({ error: "keyId is required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, userId: user.id, isActive: true },
    select: {
      id: true,
      lastPollAt: true,
      clientChannel: true,
      ipEvents: {
        where: { status: "allowed" },
        select: { ip: true, lastSeen: true },
        orderBy: { lastSeen: "desc" },
        take: 10,
      },
    },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const now = Date.now();
  const lastPollMs = apiKey.lastPollAt ? new Date(apiKey.lastPollAt).getTime() : null;
  const lastPollAgoMs = lastPollMs !== null ? now - lastPollMs : null;
  const hasActivePolling = lastPollAgoMs !== null && lastPollAgoMs < ACTIVE_THRESHOLD_MS;
  const hasBoundDevice = apiKey.ipEvents.length > 0;
  const connected = hasActivePolling || hasBoundDevice;

  if (connected) {
    // Log that setup was successfully verified (fire-and-forget)
    logAuditEvent({
      eventType: AuditEventTypes.SETUP_VERIFIED,
      userId: user.id,
      metadata: { keyId, channel: apiKey.clientChannel },
    }).catch(() => {});
  }

  return NextResponse.json({
    connected,
    lastPollAt: apiKey.lastPollAt?.toISOString() ?? null,
    lastPollAgoMs,
    allowedIps: apiKey.ipEvents.map((e) => e.ip),
  });
}
