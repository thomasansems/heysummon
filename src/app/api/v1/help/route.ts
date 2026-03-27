export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { helpCreateSchema, validateBody, requireJsonContentType } from "@/lib/validations";
import { verifyGuardReceipt } from "@/lib/guard-crypto";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { hashDeviceToken } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes, redactApiKey } from "@/lib/audit";
import { sendMessage } from "@/lib/adapters/telegram";
import { sendMessage as sendSlackMessage } from "@/lib/adapters/slack";
import { escapeSlack } from "@/lib/channels/slack";
import type { TelegramConfig, SlackConfig } from "@/lib/adapters/types";
import { getPhoneFirstConfig, initiateProviderCall } from "@/lib/adapters/twilio-voice";

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

const REQUIRE_GUARD = process.env.REQUIRE_GUARD !== "false";

if (!REQUIRE_GUARD) {
  console.warn(
    "[SECURITY] REQUIRE_GUARD is disabled. Requests will be accepted without Guard content safety verification. " +
    "Set REQUIRE_GUARD=true (or remove the variable) for production use."
  );
}
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
 * Guard receipt is required by default (REQUIRE_GUARD defaults to true).
 * Set REQUIRE_GUARD=false to disable for development without Guard.
 */
export async function POST(request: Request) {
  try {
    const ctError = requireJsonContentType(request);
    if (ctError) return ctError;

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
        hasApiKey: apiKey ? apiKey.slice(0, 10) + "..." : null,
        hasQuestion: Boolean(question),
        hasMessages: Boolean(messages) && Array.isArray(messages) && messages.length > 0,
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

    // ─── Provider + channel check ───
    // If this key is linked to a specific provider, ensure that provider exists,
    // is active, and has at least one notification channel configured.
    if (key.providerId) {
      const provider = await prisma.userProfile.findUnique({
        where: { id: key.providerId },
        select: {
          isActive: true,
          channelProviders: { where: { isActive: true }, select: { id: true } },
        },
      });
      if (!provider) {
        return NextResponse.json(
          { error: "The provider linked to this client no longer exists. Contact your provider to reissue your API key." },
          { status: 503 }
        );
      }
      if (!provider.isActive) {
        return NextResponse.json(
          { error: "The provider linked to this client is currently inactive." },
          { status: 503 }
        );
      }
      if (provider.channelProviders.length === 0) {
        return NextResponse.json(
          { error: "The provider linked to this client has no notification channel configured and cannot receive requests yet." },
          { status: 503 }
        );
      }
    }

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

    // ─── Provider availability check ───
    // Check BEFORE creating the request — reject if provider is unavailable
    // Scope to specific provider linked to this API key
    const providerProfileForAvail = await prisma.userProfile.findFirst({
      where: key.providerId
        ? { id: key.providerId }
        : { userId: key.userId },
      select: { id: true, quietHoursStart: true, quietHoursEnd: true, availableDays: true, timezone: true },
    });
    const availCheck = providerProfileForAvail
      ? getProviderAvailability(
          providerProfileForAvail.quietHoursStart,
          providerProfileForAvail.quietHoursEnd,
          providerProfileForAvail.availableDays,
          providerProfileForAvail.timezone
        )
      : { unavailable: false, nextAvailableAt: null };

    if (availCheck.unavailable) {
      // Track the missed request
      if (providerProfileForAvail) {
        await prisma.missedRequest.create({
          data: {
            apiKeyId: key.id,
            providerId: providerProfileForAvail.id,
            nextAvailableAt: availCheck.nextAvailableAt ? new Date(availCheck.nextAvailableAt) : null,
            questionPreview: (body.questionPreview || question || "")?.slice(0, 200) || null,
          },
        });
      }

      logAuditEvent({
        eventType: AuditEventTypes.HELP_REQUEST_SUBMITTED,
        userId: key.userId,
        apiKeyId: key.id,
        success: false,
        metadata: {
          reason: "provider_unavailable",
          apiKey: redactApiKey(apiKey),
          nextAvailableAt: availCheck.nextAvailableAt,
        },
        request,
      });

      const tz = providerProfileForAvail?.timezone || "UTC";
      const timeStr = availCheck.nextAvailableAt
        ? new Date(availCheck.nextAvailableAt).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
        : null;

      return NextResponse.json({
        rejected: true,
        reason: "provider_unavailable",
        nextAvailableAt: availCheck.nextAvailableAt,
        message: timeStr
          ? `Provider is not available right now. They will be available again at ${timeStr} (${tz}). You can ask your question again at that time.`
          : `Provider is not available right now. Try again later.`,
      });
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

    // ─── Phone-first: attempt voice call before chat ───
    // Scope to the specific provider linked to this API key, not all profiles for the user
    const providerProfiles = await prisma.userProfile.findMany({
      where: key.providerId
        ? { id: key.providerId }
        : { userId: key.userId },
      select: { id: true, phoneFirst: true, phoneFirstIntegrationId: true },
    });

    let phoneFirstAttempted = false;

    // Attempt phone-first call (provider is confirmed available at this point)
    for (const profile of providerProfiles) {
      if (!profile.phoneFirst || !profile.phoneFirstIntegrationId) continue;

      const phoneConfig = await getPhoneFirstConfig(profile.id);
      if (!phoneConfig) continue;

      const questionText = body.questionPreview || question || "A new help request has been submitted.";

      const callResult = await initiateProviderCall(
        helpRequest.id,
        questionText.slice(0, 500),
        phoneConfig.systemConfig,
        phoneConfig.providerConfig,
        phoneConfig.timeout
      );

      if ("callSid" in callResult) {
        phoneFirstAttempted = true;
        // Store questionPreview for TTS + mark as notified
        const updateData: Record<string, unknown> = { notifiedProviderAt: new Date() };
        if (body.questionPreview && !helpRequest.questionPreview) {
          updateData.questionPreview = body.questionPreview.slice(0, 200);
        }
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: updateData,
        }).catch(() => {});
      } else {
        console.error("[help/route] Phone-first call failed:", callResult.error);
      }
      break; // Only call the first matching profile
    }

    // Push Telegram notification to provider (fire-and-forget, non-blocking)
    // If phone-first was attempted, Telegram fallback happens via the status callback
    if (!phoneFirstAttempted) {
      prisma.channelProvider.findFirst({
        where: {
          profileId: { in: providerProfiles.map(p => p.id) },
          type: "telegram",
          isActive: true,
          status: "connected",
        },
      }).then(async (telegramChannel) => {
        if (!telegramChannel) return;
        const cfg = JSON.parse(telegramChannel.config) as TelegramConfig;
        if (!cfg.providerChatId || !cfg.botToken) return;

        const questionPreview = question ? `\n\n*Question:* ${question.slice(0, 500)}${question.length > 500 ? "…" : ""}` : "";
        const msg = `🦞 *New help request* \`${helpRequest.refCode}\`${questionPreview}\n\nReply with:\n\`/reply ${helpRequest.refCode} your answer\``;

        await sendMessage(cfg.botToken, cfg.providerChatId, msg);
        // Mark as notified
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: { notifiedProviderAt: new Date() },
        }).catch(() => {});
      }).catch((err) => {
        console.error("[help/route] Telegram notify failed:", err);
      });

      // Also try Slack notification (fire-and-forget, non-blocking)
      prisma.channelProvider.findFirst({
        where: {
          profileId: { in: providerProfiles.map(p => p.id) },
          type: "slack",
          isActive: true,
          status: "connected",
        },
      }).then(async (slackChannel) => {
        if (!slackChannel) return;
        const cfg = JSON.parse(slackChannel.config) as SlackConfig;
        if (!cfg.channelId || !cfg.botToken) return;

        const questionPreview = question ? `\n\n*Question:* ${escapeSlack(question.slice(0, 500))}${question.length > 500 ? "..." : ""}` : "";
        const msg = `*New help request* \`${helpRequest.refCode}\`${questionPreview}\n\nReply with:\n\`reply ${helpRequest.refCode} your answer\``;

        await sendSlackMessage(cfg.botToken, cfg.channelId, msg);
        // Mark as notified (if not already set by Telegram)
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: { notifiedProviderAt: new Date() },
        }).catch(() => {});
      }).catch((err) => {
        console.error("[help/route] Slack notify failed:", err);
      });
    }

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

    return NextResponse.json({
      requestId: helpRequest.id,
      refCode: helpRequest.refCode,
      status: "pending",
      expiresAt: helpRequest.expiresAt.toISOString(),
      ...(serverKeyPair && { serverPublicKey: serverKeyPair.publicKey }),
      phoneFirstAttempted,
    });
  } catch (err) {
    console.error("Help request error:", sanitizeError(err));
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
