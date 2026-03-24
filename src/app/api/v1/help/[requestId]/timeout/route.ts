export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateApiKeyRequest } from "@/lib/api-key-auth";
import { sendMessage } from "@/lib/adapters/telegram";
import { dispatchWebhookToProvider } from "@/lib/webhook";
import { logAuditEvent, AuditEventTypes } from "@/lib/audit";
import type { TelegramConfig } from "@/lib/adapters/types";

/**
 * POST /api/v1/help/:requestId/timeout
 *
 * Called by the consumer SDK when the blocking poll times out.
 * Records the timeout, notifies the provider via Telegram, and dispatches a webhook.
 *
 * Auth: consumer API key (must own the request)
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const { requestId } = await params;

  const authResult = await validateApiKeyRequest(request);
  if (!authResult.ok) return authResult.response;

  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      refCode: true,
      apiKeyId: true,
      expertId: true,
      status: true,
      questionPreview: true,
      clientTimedOutAt: true,
      apiKey: { select: { key: true, name: true } },
    },
  });

  if (!helpRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Verify the requesting API key owns this request
  const providedKey = request.headers.get("x-api-key");
  if (helpRequest.apiKey.key !== providedKey) {
    return NextResponse.json({ error: "Not authorized for this request" }, { status: 403 });
  }

  // Only record timeout on pending/active requests that haven't already timed out
  if (helpRequest.clientTimedOutAt) {
    return NextResponse.json({ ok: true, alreadyTimedOut: true });
  }

  if (helpRequest.status !== "pending" && helpRequest.status !== "active") {
    return NextResponse.json({ ok: true, status: helpRequest.status });
  }

  // Record the timeout
  await prisma.helpRequest.update({
    where: { id: requestId },
    data: { clientTimedOutAt: new Date() },
  });

  // Audit log
  logAuditEvent({
    eventType: AuditEventTypes.CLIENT_TIMEOUT,
    apiKeyId: helpRequest.apiKeyId,
    success: true,
    metadata: {
      requestId,
      refCode: helpRequest.refCode,
      clientName: helpRequest.apiKey.name,
    },
    request,
  });

  // Notify provider via Telegram (fire-and-forget)
  notifyProviderTimeout(helpRequest.expertId, helpRequest.refCode, helpRequest.questionPreview).catch(() => {});

  // Dispatch webhook (fire-and-forget)
  dispatchWebhookToProvider(helpRequest.expertId, {
    type: "client_timeout",
    requestId: helpRequest.id,
    refCode: helpRequest.refCode ?? undefined,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}

/**
 * Send a Telegram notification to the provider that the client timed out waiting.
 */
async function notifyProviderTimeout(
  expertId: string,
  refCode: string | null,
  questionPreview: string | null
) {
  // Find active Telegram channel for this provider
  const profile = await prisma.userProfile.findFirst({
    where: { userId: expertId },
    include: {
      channelProviders: {
        where: { type: "telegram", isActive: true, status: "connected" },
        take: 1,
      },
    },
  });

  const telegramChannel = profile?.channelProviders[0];
  if (!telegramChannel) return;

  const cfg = JSON.parse(telegramChannel.config) as TelegramConfig;
  if (!cfg.providerChatId || !cfg.botToken) return;

  const ref = refCode ? `\`${refCode}\`` : "a request";
  const preview = questionPreview
    ? `\n\n*Question:* ${questionPreview.slice(0, 300)}${questionPreview.length > 300 ? "..." : ""}`
    : "";

  const msg = `*Client timed out* waiting for your response on ${ref}.${preview}\n\nThe request is still open -- you can still respond from the dashboard.`;

  await sendMessage(cfg.botToken, cfg.providerChatId, msg);
}
