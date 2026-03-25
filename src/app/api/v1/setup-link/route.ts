import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";

const SETUP_LINK_TTL_SECONDS = 24 * 60 * 60; // 24 hours

/**
 * POST /api/v1/setup-link
 *
 * Generates a time-limited (24h) setup URL for a client key.
 * The URL contains only an opaque token — all sensitive data is stored server-side.
 *
 * Body: { keyId: string, channel, subChannel?, timeout?, pollInterval?, globalInstall? }
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

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, provider: { userId: user.id } },
    select: { id: true, provider: { select: { name: true } } },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const baseUrl = getPublicBaseUrl(request);
  const opaqueToken = `st_${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + SETUP_LINK_TTL_SECONDS * 1000);

  await prisma.setupToken.create({
    data: {
      token: opaqueToken,
      apiKeyId: apiKey.id,
      baseUrl,
      channel,
      subChannel: subChannel ?? null,
      providerName: apiKey.provider?.name ?? null,
      timeout: timeout ?? 900,
      pollInterval: pollInterval ?? 3,
      globalInstall: globalInstall ?? true,
      expiresAt,
    },
  });

  const setupUrl = `${baseUrl}/setup/${opaqueToken}`;

  return NextResponse.json({
    setupUrl,
    expiresInSeconds: SETUP_LINK_TTL_SECONDS,
    expiresAt: expiresAt.toISOString(),
  });
}
