import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";

const SETUP_LINK_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_RECENT_CONTEXTS = 10;

/**
 * POST /api/v1/setup-link
 *
 * Generates a time-limited (24h) setup URL for a client key.
 * The URL contains only an opaque token — all sensitive data is stored server-side.
 *
 * Body: { keyId: string, channel, subChannel?, summonContext?, timeout?, pollInterval?, globalInstall? }
 * Auth: dashboard user (must own the key)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { keyId, channel, subChannel, summonContext, summonContextMeta, timeout, pollInterval, globalInstall } = body as {
    keyId: string;
    channel: "openclaw" | "claudecode" | "codex" | "gemini" | "cursor";
    subChannel?: "telegram" | "whatsapp";
    summonContext?: string;
    summonContextMeta?: Record<string, unknown>;
    timeout?: number;
    pollInterval?: number;
    globalInstall?: boolean;
  };

  if (!keyId || !channel) {
    return NextResponse.json({ error: "keyId and channel are required" }, { status: 400 });
  }

  const apiKey = await prisma.apiKey.findFirst({
    where: { id: keyId, expert: { userId: user.id } },
    select: { id: true, expertId: true, expert: { select: { name: true } } },
  });

  if (!apiKey) {
    return NextResponse.json({ error: "Key not found" }, { status: 404 });
  }

  const baseUrl = getPublicBaseUrl(request);
  const opaqueToken = `st_${randomBytes(24).toString("base64url")}`;
  const expiresAt = new Date(Date.now() + SETUP_LINK_TTL_SECONDS * 1000);

  const trimmedContext = summonContext?.trim().slice(0, 2000) || null;

  await prisma.setupToken.create({
    data: {
      token: opaqueToken,
      apiKeyId: apiKey.id,
      baseUrl,
      channel,
      subChannel: subChannel ?? null,
      expertName: apiKey.expert?.name ?? null,
      summonContext: trimmedContext,
      timeout: timeout ?? 900,
      pollInterval: pollInterval ?? 3,
      globalInstall: globalInstall ?? true,
      expiresAt,
    },
  });

  // Save context to expert's recentSummonContexts (prepend, dedup, cap at 10)
  // Supports both legacy string entries and new { text, meta } objects
  if (trimmedContext && apiKey.expertId) {
    const expert = await prisma.userProfile.findUnique({
      where: { id: apiKey.expertId },
      select: { recentSummonContexts: true },
    });

    type RecentEntry = string | { text: string; meta: Record<string, unknown> };
    const existing: RecentEntry[] = expert?.recentSummonContexts
      ? JSON.parse(expert.recentSummonContexts)
      : [];

    const newEntry: RecentEntry = summonContextMeta
      ? { text: trimmedContext, meta: summonContextMeta }
      : trimmedContext;

    const getEntryText = (entry: RecentEntry): string =>
      typeof entry === "string" ? entry : entry.text;

    const deduped = [
      newEntry,
      ...existing.filter((c) => getEntryText(c) !== trimmedContext),
    ];
    const capped = deduped.slice(0, MAX_RECENT_CONTEXTS);

    await prisma.userProfile.update({
      where: { id: apiKey.expertId },
      data: { recentSummonContexts: JSON.stringify(capped) },
    });
  }

  const setupUrl = `${baseUrl}/setup/${opaqueToken}`;

  return NextResponse.json({
    setupUrl,
    expiresInSeconds: SETUP_LINK_TTL_SECONDS,
    expiresAt: expiresAt.toISOString(),
  });
}
