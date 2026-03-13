import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import jwt from "jsonwebtoken";

const SETUP_LINK_TTL_SECONDS = 10 * 60; // 10 minutes

/**
 * POST /api/v1/setup-link
 *
 * Generates a time-limited (10 min) signed setup URL for a client key.
 * The URL is public but expires after 10 minutes to protect credentials.
 *
 * Body: { keyId: string, channel: "openclaw" | "claudecode", subChannel?: "telegram" | "whatsapp" }
 * Auth: dashboard user (must own the key)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { keyId, channel, subChannel } = body as {
    keyId: string;
    channel: "openclaw" | "claudecode";
    subChannel?: "telegram" | "whatsapp";
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

  const proto = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") ||
    request.headers.get("host") ||
    "localhost:3425";
  const baseUrl = `${proto}://${host}`;

  const token = jwt.sign(
    {
      keyId: apiKey.id,
      key: apiKey.key,
      baseUrl,
      channel,
      subChannel: subChannel ?? null,
      providerName: apiKey.provider?.name ?? null,
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
