import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";
import jwt from "jsonwebtoken";

const SETUP_LINK_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * POST /api/v1/setup-link
 *
 * Generates a time-limited (24h) signed setup URL for a client key.
 * The URL expires after 24 hours, but auto-disables when the first device binds.
 *
 * Body: { keyId: string, channel: "openclaw" | "claudecode" | "codex" | "gemini" | "cursor", subChannel?: "telegram" | "whatsapp" }
 * Auth: dashboard user (must own the key)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { keyId, channel, subChannel, timeout, pollInterval, globalInstall } = body as {
    keyId: string;
    channel: "openclaw" | "claudecode" | "codex" | "gemini" | "cursor";
    subChannel?: "telegram" | "whatsapp";
    timeout?: number;
    pollInterval?: number;
    globalInstall?: boolean;
  };

  if (!keyId || !channel) {
    return NextResponse.json({ error: "keyId and channel are required" }, { status: 400 });
  }

  // Verify ownership
  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, provider: { userId: user.id } },
    select: { id: true, key: true, name: true, provider: { select: { name: true } } },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const secret = process.env.JWT_SECRET ?? process.env.NEXTAUTH_SECRET ?? "heysummon-setup-secret";

  const baseUrl = getPublicBaseUrl(request);

  const token = jwt.sign(
    {
      keyId: apiKey.id,
      key: apiKey.key,
      baseUrl,
      channel,
      subChannel: subChannel ?? null,
      providerName: apiKey.provider?.name ?? null,
      ...(timeout != null && timeout !== 900 && { timeout }),
      ...(pollInterval != null && pollInterval !== 3 && { pollInterval }),
      ...(globalInstall === false && { globalInstall: false }),
    },
    secret,
    { expiresIn: SETUP_LINK_TTL_SECONDS }
  );

  const setupUrl = `${baseUrl}/setup/${token}`;

  return NextResponse.json({
    setupUrl,
    expiresInSeconds: SETUP_LINK_TTL_SECONDS,
    expiresAt: new Date(Date.now() + SETUP_LINK_TTL_SECONDS * 1000).toISOString(),
  });
}
