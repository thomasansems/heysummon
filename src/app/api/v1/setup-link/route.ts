import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getPublicBaseUrl } from "@/lib/public-url";
import { CUSTOM_CLIENT_LABEL_MAX } from "@/lib/validations";

const SETUP_LINK_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MAX_RECENT_CONTEXTS = 10;
// eslint-disable-next-line no-control-regex -- intentionally rejecting control chars in the label
const CUSTOM_LABEL_DISALLOWED = /[\x00-\x1f\x7f<>]/;

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
  const { keyId, channel, subChannel, summonContext, summonContextMeta, timeout, pollInterval, globalInstall, timeoutFallback } = body as {
    keyId: string;
    channel: "openclaw" | "claudecode" | "codex" | "gemini" | "cursor" | "custom";
    subChannel?: string;
    summonContext?: string;
    summonContextMeta?: Record<string, unknown>;
    timeout?: number;
    pollInterval?: number;
    globalInstall?: boolean;
    timeoutFallback?: string;
  };

  if (!keyId || !channel) {
    return NextResponse.json({ error: "keyId and channel are required" }, { status: 400 });
  }

  const normalizedSubChannel =
    typeof subChannel === "string" ? subChannel.trim() : null;

  if (channel === "custom") {
    if (!normalizedSubChannel) {
      return NextResponse.json(
        { error: "subChannel (client label) is required when channel is 'custom'" },
        { status: 400 },
      );
    }
    if (normalizedSubChannel.length > CUSTOM_CLIENT_LABEL_MAX) {
      return NextResponse.json(
        { error: `Client label must be ${CUSTOM_CLIENT_LABEL_MAX} characters or fewer` },
        { status: 400 },
      );
    }
    if (CUSTOM_LABEL_DISALLOWED.test(normalizedSubChannel)) {
      return NextResponse.json(
        { error: "Client label contains disallowed characters" },
        { status: 400 },
      );
    }
  } else if (normalizedSubChannel && !["telegram", "whatsapp"].includes(normalizedSubChannel)) {
    return NextResponse.json(
      { error: "subChannel must be 'telegram' or 'whatsapp' for this channel" },
      { status: 400 },
    );
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
      subChannel: normalizedSubChannel,
      expertName: apiKey.expert?.name ?? null,
      summonContext: trimmedContext,
      timeout: timeout ?? 900,
      pollInterval: pollInterval ?? 3,
      timeoutFallback: timeoutFallback ?? "proceed_cautiously",
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
