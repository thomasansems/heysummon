export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { helpCreateSchema, validateBody } from "@/lib/validations";
import { verifyGuardReceipt } from "@/lib/guard-crypto";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { hashDeviceToken } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes, redactApiKey } from "@/lib/audit";

/**
 * Returns whether the provider is currently unavailable and when they'll next be available.
 * availableFrom/Until are "HH:MM" strings (the AVAILABLE window).
 * availableDays is comma-separated weekday numbers (0=Sun … 6=Sat).
 */
function getProviderAvailability(
  availableFrom: string | null,
  availableUntil: string | null,
  availableDays: string | null,
  timezone: string | null
): { unavailable: boolean; nextAvailableAt: string | null } {
  if (!availableFrom && !availableUntil && !availableDays) {
    return { unavailable: false, nextAvailableAt: null };
  }
  try {
    const tz = timezone || "UTC";
    const now = new Date();
    const timeFmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
    });
    const dayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: tz });
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    const getTimeParts = (d: Date) => {
      const parts = timeFmt.formatToParts(d);
      const h = parts.find((p) => p.type === "hour")?.value ?? "00";
      const mi = parts.find((p) => p.type === "minute")?.value ?? "00";
      return { time: `${h}:${mi}`, day: dayMap[dayFmt.format(d)] ?? d.getDay() };
    };

    const days = availableDays
      ? availableDays.split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d))
      : null;
    const from = availableFrom ?? "00:00";
    const until = availableUntil ?? "23:59";

    const isAvailable = (d: Date) => {
      const { time, day } = getTimeParts(d);
      const dayOk = !days || days.includes(day);
      const timeOk = from <= until ? time >= from && time < until : time >= from || time < until;
      return dayOk && timeOk;
    };

    if (isAvailable(now)) return { unavailable: false, nextAvailableAt: null };

    // Walk forward in 15-min steps up to 8 days to find next slot
    for (let i = 15; i <= 8 * 24 * 60; i += 15) {
      const candidate = new Date(now.getTime() + i * 60 * 1000);
      if (isAvailable(candidate)) {
        return { unavailable: true, nextAvailableAt: candidate.toISOString() };
      }
    }
    return { unavailable: true, nextAvailableAt: null };
  } catch {
    return { unavailable: false, nextAvailableAt: null };
  }
}

const REQUIRE_GUARD = process.env.REQUIRE_GUARD === "true";
const REQUEST_TTL_MS = parseInt(process.env.HEYSUMMON_REQUEST_TTL_MS || String(72 * 60 * 60 * 1000), 10);
const DEBUG = process.env.DEBUG === "true";

/**
 * POST /api/v1/help — Submit a help request.
 *
 * Guard reverse proxy flow:
 *   1. SDK sends request to Guard (single entry point)
 *   2. Guard validates content, signs Ed25519 receipt, proxies to Platform
 *   3. Platform verifies X-Guard-Receipt header
 *
 * If REQUIRE_GUARD=true, a valid guard receipt is mandatory.
 * If not set, guard is optional (backward compatible for dev without Guard).
 */
export async function POST(request: Request) {
  try {
    const raw = await request.json();
    const parsed = validateBody(helpCreateSchema, raw);
    if (!parsed.success) return parsed.response;

    const body = parsed.data;
    const {
      apiKey,
      signPublicKey,
      encryptPublicKey,
      messages,
      question,
      requiresApproval,
      publicKey,
      messageCount,
    } = body;

    // Debug logging
    if (DEBUG) {
      console.log("[POST /api/v1/help] Request received:", {
        question: question,
        requiresApproval,
        apiKey: apiKey ? apiKey.slice(0, 20) + "..." : null,
        hasQuestion: !!question,
        hasMessages: !!messages && Array.isArray(messages) && messages.length > 0,
        messageCount,
        hasSignPublicKey: !!signPublicKey,
        hasEncryptPublicKey: !!encryptPublicKey,
        hasPublicKey: !!publicKey,
      });
    }

    if (!apiKey) {
      return NextResponse.json(
        { error: "apiKey is required" },
        { status: 400 }
      );
    }

    if (!signPublicKey || !encryptPublicKey) {
      if (!publicKey) {
        return NextResponse.json(
          { error: "signPublicKey and encryptPublicKey are required (or publicKey for legacy v3)" },
          { status: 400 }
        );
      }
    }

    // Validate API key (body apiKey or x-api-key header, with full enhanced checks)
    const authResult = await validateApiKeyRequest(request, {
      include: { user: true },
      apiKeyOverride: apiKey,
    });
    if (!authResult.ok) return authResult.response;
    const key = authResult.apiKey;

    // ─── Guard Receipt Verification (Ed25519) ───
    const receiptB64 = request.headers.get("x-guard-receipt");
    const signatureB64 = request.headers.get("x-guard-receipt-sig");
    const hasReceipt = receiptB64 && signatureB64;

    if (REQUIRE_GUARD && !hasReceipt) {
      return NextResponse.json(
        { error: "Guard receipt required. All requests must go through the Guard reverse proxy." },
        { status: 403 }
      );
    }

    let guardVerified = false;

    if (hasReceipt) {
      const receipt = verifyGuardReceipt(receiptB64, signatureB64);
      if (!receipt) {
        return NextResponse.json(
          { error: "Invalid guard receipt. Signature verification failed, receipt expired, or replay detected." },
          { status: 403 }
        );
      }
      guardVerified = true;
    }

    const refCode = await generateUniqueRefCode();
    const expiresAt = new Date(Date.now() + REQUEST_TTL_MS);

    // v3 legacy: encrypt messages at rest with server key
    let encryptedMessages = null;
    let encryptedQuestion = null;
    let serverKeyPair = null;

    if (messages || question) {
      serverKeyPair = generateKeyPair();
      if (messages && Array.isArray(messages)) {
        const limit = typeof messageCount === 'number' ? messageCount : messages.length;
        const trimmedMessages = limit === 0 ? [] : messages.slice(-Math.min(limit, messages.length));
        encryptedMessages = encryptMessage(
          JSON.stringify(trimmedMessages),
          serverKeyPair.publicKey
        );
      }
      if (question) {
        encryptedQuestion = encryptMessage(question, serverKeyPair.publicKey);
      }
    }

    const helpRequest = await prisma.helpRequest.create({
      data: {
        refCode,
        apiKeyId: key.id,
        expertId: key.userId,
        expiresAt,

        consumerSignPubKey: signPublicKey || null,
        consumerEncryptPubKey: encryptPublicKey || null,

        messages: encryptedMessages,
        question: encryptedQuestion,
        consumerPublicKey: publicKey || null,
        serverPublicKey: serverKeyPair?.publicKey || null,
        serverPrivateKey: serverKeyPair?.privateKey || null,

        requiresApproval: requiresApproval ?? false,
        contentFlags: null,
        guardVerified,
      },
    });

    // Debug logging — show what was stored
    if (DEBUG) {
      console.log("[POST /api/v1/help] Request created:", {
        id: helpRequest.id,
        refCode: helpRequest.refCode,
        question: helpRequest.question || null,
        requiresApproval: helpRequest.requiresApproval,
        expiresAt: helpRequest.expiresAt.toISOString(),
        expertId: helpRequest.expertId,
      });
    }

    logAuditEvent({
      eventType: AuditEventTypes.HELP_REQUEST_SUBMITTED,
      userId: key.userId,
      apiKeyId: key.id,
      success: true,
      metadata: {
        requestId: helpRequest.id,
        refCode: helpRequest.refCode,
        apiKey: redactApiKey(apiKey),
        guardVerified,
      },
      request,
    });

    // Check provider availability to inform consumer
    const providerProfile = await prisma.userProfile.findFirst({
      where: { userId: key.userId },
      select: { quietHoursStart: true, quietHoursEnd: true, availableDays: true, timezone: true },
    });

    const availability = providerProfile
      ? getProviderAvailability(
          providerProfile.quietHoursStart,
          providerProfile.quietHoursEnd,
          providerProfile.availableDays,
          providerProfile.timezone
        )
      : { unavailable: false, nextAvailableAt: null };

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      expiresAt: helpRequest.expiresAt.toISOString(),
      ...(serverKeyPair && { serverPublicKey: serverKeyPair.publicKey }),
      providerUnavailable: availability.unavailable,
      nextAvailableAt: availability.nextAvailableAt,
    });
  } catch (err) {
    console.error("Help request error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
