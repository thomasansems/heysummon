export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateUniqueRefCode } from "@/lib/refcode";
import { generateKeyPair, encryptMessage } from "@/lib/crypto";
import { helpCreateSchema, validateBody, requireJsonContentType } from "@/lib/validations";
import { checkContentSafety, applySanitizedContent } from "@/lib/content-safety-middleware";
import { validateApiKeyRequest, sanitizeError } from "@/lib/api-key-auth";
import { hashDeviceToken } from "@/lib/api-key-auth";
import { logAuditEvent, AuditEventTypes, redactApiKey } from "@/lib/audit";
import { sendMessage, sendLongMessage, sendMessageWithButtons, escapeTelegramMarkdown } from "@/lib/adapters/telegram";
import { sendMessage as sendSlackMessage, sendMessageWithBlocks as sendSlackBlocks } from "@/lib/adapters/slack";
import { sendNotification, sendNotificationWithActions } from "@/lib/adapters/openclaw";
import { getPublicBaseUrl } from "@/lib/public-url";
import { escapeSlack } from "@/lib/channels/slack";
import type { TelegramConfig, SlackConfig, OpenClawConfig } from "@/lib/adapters/types";
import { getPhoneFirstConfig, initiateExpertCall } from "@/lib/adapters/twilio-voice";

/**
 * Returns whether the expert is currently unavailable and when they'll next be available.
 * availableFrom/Until are "HH:MM" strings (the AVAILABLE window).
 * availableDays is comma-separated weekday numbers (0=Sun … 6=Sat).
 */
function getExpertAvailability(
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

const REQUEST_TTL_MS = parseInt(process.env.HEYSUMMON_REQUEST_TTL_MS || String(72 * 60 * 60 * 1000), 10);
const DEBUG = process.env.DEBUG === "true";

/**
 * POST /api/v1/help — Submit a help request.
 *
 * Content safety runs as in-process middleware:
 *   1. Validate and sanitize content (HTML, URLs, PII)
 *   2. Block requests containing credit cards or SSN/BSN (422)
 *   3. Process the request with sanitized content
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
        hasApiKey: Boolean(apiKey),
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
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (!signPublicKey || !encryptPublicKey) {
      if (!publicKey) {
        return NextResponse.json(
          { error: "Missing required encryption keys" },
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

    // ─── Expert + channel check ───
    // If this key is linked to a specific expert, ensure that expert exists,
    // is active, and has at least one notification channel configured.
    if (key.expertId) {
      const expert = await prisma.userProfile.findUnique({
        where: { id: key.expertId },
        select: {
          isActive: true,
          expertChannels: { where: { isActive: true }, select: { id: true } },
        },
      });
      if (!expert) {
        return NextResponse.json(
          { error: "The expert linked to this client no longer exists. Contact your expert to reissue your API key." },
          { status: 503 }
        );
      }
      if (!expert.isActive) {
        return NextResponse.json(
          { error: "The expert linked to this client is currently inactive." },
          { status: 503 }
        );
      }
      if (expert.expertChannels.length === 0) {
        return NextResponse.json(
          { error: "The expert linked to this client has no notification channel configured and cannot receive requests yet." },
          { status: 503 }
        );
      }
    }

    // ─── Content Safety (in-process) ───
    const safetyCheck = checkContentSafety(body as Record<string, unknown>);
    if (!safetyCheck.passed) {
      return safetyCheck.response;
    }
    applySanitizedContent(body as Record<string, unknown>, safetyCheck.sanitizedText);
    const guardVerified = true; // Content safety always runs in-process

    // ─── Expert availability check ───
    // Check BEFORE creating the request — reject if expert is unavailable
    // Scope to specific expert linked to this API key
    const expertProfileForAvail = await prisma.userProfile.findFirst({
      where: key.expertId
        ? { id: key.expertId }
        : { userId: key.userId },
      select: { id: true, quietHoursStart: true, quietHoursEnd: true, availableDays: true, timezone: true },
    });
    const availCheck = expertProfileForAvail
      ? getExpertAvailability(
          expertProfileForAvail.quietHoursStart,
          expertProfileForAvail.quietHoursEnd,
          expertProfileForAvail.availableDays,
          expertProfileForAvail.timezone
        )
      : { unavailable: false, nextAvailableAt: null };

    if (availCheck.unavailable) {
      // Track the missed request
      if (expertProfileForAvail) {
        await prisma.missedRequest.create({
          data: {
            apiKeyId: key.id,
            expertId: expertProfileForAvail.id,
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
          reason: "expert_unavailable",
          apiKey: redactApiKey(apiKey),
          nextAvailableAt: availCheck.nextAvailableAt,
        },
        request,
      });

      const tz = expertProfileForAvail?.timezone || "UTC";
      const timeStr = availCheck.nextAvailableAt
        ? new Date(availCheck.nextAvailableAt).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" })
        : null;

      return NextResponse.json({
        rejected: true,
        reason: "expert_unavailable",
        nextAvailableAt: availCheck.nextAvailableAt,
        message: timeStr
          ? `Expert is not available right now. They will be available again at ${timeStr} (${tz}). You can ask your question again at that time.`
          : `Expert is not available right now. Try again later.`,
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
        contentFlags: safetyCheck.flags.length > 0 ? JSON.stringify(safetyCheck.flags) : null,
        guardVerified,
      },
    });

    // ─── Phone-first: attempt voice call before chat ───
    // Scope to the specific expert linked to this API key, not all profiles for the user
    const expertProfiles = await prisma.userProfile.findMany({
      where: key.expertId
        ? { id: key.expertId }
        : { userId: key.userId },
      select: { id: true, phoneFirst: true, phoneFirstIntegrationId: true },
    });

    let phoneFirstAttempted = false;

    // Attempt phone-first call (expert is confirmed available at this point)
    for (const profile of expertProfiles) {
      if (!profile.phoneFirst || !profile.phoneFirstIntegrationId) continue;

      const phoneConfig = await getPhoneFirstConfig(profile.id);
      if (!phoneConfig) continue;

      const questionText = body.questionPreview || question || "A new help request has been submitted.";

      const callResult = await initiateExpertCall(
        helpRequest.id,
        questionText.slice(0, 500),
        phoneConfig.systemConfig,
        phoneConfig.expertConfig,
        phoneConfig.timeout
      );

      if ("callSid" in callResult) {
        phoneFirstAttempted = true;
        // Store questionPreview for TTS + mark as notified
        const updateData: Record<string, unknown> = { notifiedExpertAt: new Date() };
        if (!helpRequest.questionPreview) {
          updateData.questionPreview = questionText.slice(0, 200);
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

    // Push Telegram notification to expert (fire-and-forget, non-blocking)
    // If phone-first was attempted, Telegram fallback happens via the status callback
    if (!phoneFirstAttempted) {
      prisma.expertChannel.findFirst({
        where: {
          profileId: { in: expertProfiles.map(p => p.id) },
          type: "telegram",
          isActive: true,
          status: "connected",
        },
      }).then(async (telegramChannel) => {
        if (!telegramChannel) return;
        const cfg = JSON.parse(telegramChannel.config) as TelegramConfig;
        if (!cfg.expertChatId || !cfg.botToken) return;

        const clientName = escapeTelegramMarkdown(key.name || "Unknown client");
        const escapedQuestion = question ? escapeTelegramMarkdown(question) : "";
        // Inline if the full question + chrome fits comfortably under Telegram's
        // 4096-char per-message limit; otherwise send the question as follow-up
        // message(s) so the expert sees the full content instead of a truncated preview.
        const inlineThreshold = 3500;
        const fitsInline = escapedQuestion.length <= inlineThreshold;
        const inlineQuestionLine = escapedQuestion ? `\n"${escapedQuestion}"\n` : "\n";

        if (helpRequest.requiresApproval) {
          const headerMsg = [
            `*Approval required* from ${clientName}`,
            `Ref: \`${helpRequest.refCode}\``,
            fitsInline ? inlineQuestionLine : "\n",
          ].join("\n");
          await sendMessageWithButtons(cfg.botToken, cfg.expertChatId, headerMsg, [
            [
              { text: "\u2713 Approve", callback_data: `approve:${helpRequest.id}` },
              { text: "\u2717 Deny", callback_data: `deny:${helpRequest.id}` },
            ],
          ]);
          if (!fitsInline && escapedQuestion) {
            await sendLongMessage(cfg.botToken, cfg.expertChatId, `*Question:*\n"${escapedQuestion}"`);
          }
        } else if (fitsInline) {
          const msg = [
            `*New help request* from ${clientName}`,
            inlineQuestionLine,
            `Reply with:`,
            `\`/reply ${helpRequest.refCode} your answer\``,
          ].join("\n");
          await sendMessage(cfg.botToken, cfg.expertChatId, msg);
        } else {
          await sendMessage(
            cfg.botToken,
            cfg.expertChatId,
            `*New help request* from ${clientName}\nRef: \`${helpRequest.refCode}\``,
          );
          await sendLongMessage(cfg.botToken, cfg.expertChatId, `*Question:*\n"${escapedQuestion}"`);
          await sendMessage(
            cfg.botToken,
            cfg.expertChatId,
            `Reply with:\n\`/reply ${helpRequest.refCode} your answer\``,
          );
        }
        // Mark as notified
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: { notifiedExpertAt: new Date() },
        }).catch(() => {});
      }).catch((err) => {
        console.error("[help/route] Telegram notify failed:", err);
      });

      // Also try Slack notification (fire-and-forget, non-blocking)
      prisma.expertChannel.findFirst({
        where: {
          profileId: { in: expertProfiles.map(p => p.id) },
          type: "slack",
          isActive: true,
          status: "connected",
        },
      }).then(async (slackChannel) => {
        if (!slackChannel) return;
        const cfg = JSON.parse(slackChannel.config) as SlackConfig;
        if (!cfg.channelId || !cfg.botToken) return;

        const escapedSlackQuestion = question ? escapeSlack(question) : "";
        // Slack section_block text is capped at 3000 chars; plain chat.postMessage at ~40000.
        // For approval (uses blocks), keep block compact and send the full question as a
        // follow-up plain message when it would overflow the block limit.
        const slackBlockInlineLimit = 2500;
        const slackPlainInlineLimit = 35000;
        const questionFitsInBlock = escapedSlackQuestion.length <= slackBlockInlineLimit;
        const questionFitsInPlain = escapedSlackQuestion.length <= slackPlainInlineLimit;
        const blockQuestionLine = escapedSlackQuestion && questionFitsInBlock
          ? `\n\n*Question:* ${escapedSlackQuestion}`
          : "";
        const plainQuestionLine = escapedSlackQuestion && questionFitsInPlain
          ? `\n\n*Question:* ${escapedSlackQuestion}`
          : "";

        if (helpRequest.requiresApproval) {
          const msg = `*Approval required* \`${helpRequest.refCode}\`${blockQuestionLine}`;
          await sendSlackBlocks(cfg.botToken, cfg.channelId, msg, [
            { text: "\u2713 Approve", action_id: "approve_request", value: helpRequest.id, style: "primary" },
            { text: "\u2717 Deny", action_id: "deny_request", value: helpRequest.id, style: "danger" },
          ]);
          if (!questionFitsInBlock && escapedSlackQuestion) {
            const followUp = questionFitsInPlain
              ? `*Question:* ${escapedSlackQuestion}`
              : `*Question (truncated):* ${escapedSlackQuestion.slice(0, slackPlainInlineLimit)}\u2026`;
            await sendSlackMessage(cfg.botToken, cfg.channelId, followUp);
          }
        } else if (questionFitsInPlain) {
          const msg = `*New help request* \`${helpRequest.refCode}\`${plainQuestionLine}\n\nReply with:\n\`reply ${helpRequest.refCode} your answer\``;
          await sendSlackMessage(cfg.botToken, cfg.channelId, msg);
        } else {
          await sendSlackMessage(
            cfg.botToken,
            cfg.channelId,
            `*New help request* \`${helpRequest.refCode}\``,
          );
          await sendSlackMessage(
            cfg.botToken,
            cfg.channelId,
            `*Question (truncated):* ${escapedSlackQuestion.slice(0, slackPlainInlineLimit)}\u2026`,
          );
          await sendSlackMessage(
            cfg.botToken,
            cfg.channelId,
            `Reply with:\n\`reply ${helpRequest.refCode} your answer\``,
          );
        }
        // Mark as notified (if not already set by Telegram)
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: { notifiedExpertAt: new Date() },
        }).catch(() => {});
      }).catch((err) => {
        console.error("[help/route] Slack notify failed:", err);
      });

      // Also try OpenClaw notification (fire-and-forget, non-blocking)
      prisma.expertChannel.findFirst({
        where: {
          profileId: { in: expertProfiles.map(p => p.id) },
          type: "openclaw",
          isActive: true,
          status: "connected",
        },
      }).then(async (openclawChannel) => {
        if (!openclawChannel) return;
        const cfg = JSON.parse(openclawChannel.config) as OpenClawConfig & { webhookSecret?: string };
        if (!cfg.webhookUrl || !cfg.apiKey) return;

        // OpenClaw webhook payloads accept the full question — no Telegram/Slack-style block limits.
        const questionPreview = question ? `\n\nQuestion: ${question}` : "";
        const baseUrl = getPublicBaseUrl();
        const callbackUrl = `${baseUrl}/api/adapters/openclaw/${openclawChannel.id}/webhook`;

        if (helpRequest.requiresApproval) {
          await sendNotificationWithActions(
            cfg.webhookUrl,
            cfg.apiKey,
            cfg.webhookSecret ?? "",
            callbackUrl,
            {
              requestId: helpRequest.id,
              refCode: helpRequest.refCode ?? "",
              message: `Approval required ${helpRequest.refCode}${questionPreview}`,
            },
          );
        } else {
          await sendNotification(
            cfg.webhookUrl,
            cfg.apiKey,
            cfg.webhookSecret ?? "",
            {
              type: "help_request",
              requestId: helpRequest.id,
              refCode: helpRequest.refCode,
              message: `New help request ${helpRequest.refCode}${questionPreview}`,
              callbackUrl,
            },
          );
        }
        // Mark as notified (if not already set by Telegram/Slack)
        await prisma.helpRequest.update({
          where: { id: helpRequest.id },
          data: { notifiedExpertAt: new Date() },
        }).catch(() => {});
      }).catch((err) => {
        console.error("[help/route] OpenClaw notify failed:", err);
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
