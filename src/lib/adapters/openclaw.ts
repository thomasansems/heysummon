import type { ChannelAdapter, OpenClawConfig } from "./types";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import crypto from "node:crypto";

/** Send a notification to the configured OpenClaw webhook URL */
export async function sendNotification(
  webhookUrl: string,
  apiKey: string,
  webhookSecret: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-OpenClaw-Signature": signature,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to send OpenClaw notification: HTTP ${res.status} — ${text}`);
  }
}

/** Send a notification with approval action URLs */
export async function sendNotificationWithActions(
  webhookUrl: string,
  apiKey: string,
  webhookSecret: string,
  callbackBaseUrl: string,
  payload: {
    requestId: string;
    refCode: string;
    message: string;
  },
): Promise<void> {
  await sendNotification(webhookUrl, apiKey, webhookSecret, {
    type: "approval_required",
    requestId: payload.requestId,
    refCode: payload.refCode,
    message: payload.message,
    actions: {
      approve: `${callbackBaseUrl}?action=approve&requestId=${payload.requestId}`,
      deny: `${callbackBaseUrl}?action=deny&requestId=${payload.requestId}`,
    },
    callbackUrl: callbackBaseUrl,
  });
}

/** Verify an incoming OpenClaw webhook signature */
export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: string,
  signature: string,
): boolean {
  const computed = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");

  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, signatureBuf);
}

export const openClawAdapter: ChannelAdapter = {
  type: "openclaw",

  validateConfig(config: unknown) {
    if (!config || typeof config !== "object") {
      return { valid: false, error: "Config is required" };
    }

    const c = config as Record<string, unknown>;
    if (!c.apiKey || typeof c.apiKey !== "string" || c.apiKey.trim().length === 0) {
      return { valid: false, error: "API key is required" };
    }

    const validated: OpenClawConfig = {
      apiKey: c.apiKey.trim(),
      webhookUrl: typeof c.webhookUrl === "string" ? c.webhookUrl.trim() : undefined,
    };

    return { valid: true, config: validated };
  },

  async onActivate(channelId: string, config) {
    const ocConfig = config as OpenClawConfig;

    // Generate webhook secret for verifying incoming callbacks
    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const baseUrl = getPublicBaseUrl();
    const callbackUrl = `${baseUrl}/api/adapters/openclaw/${channelId}/webhook`;

    // Update channel with webhook secret and callback URL
    await prisma.channelProvider.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify({
          ...ocConfig,
          webhookSecret,
        }),
        status: "connected",
        errorMessage: `OpenClaw callback URL: ${callbackUrl}\nWebhook secret: ${webhookSecret}`,
      },
    });
  },

  async onDeactivate(_channelId: string, _config) {
    // No external cleanup needed for OpenClaw
  },

  async sendMessage(_chatId: string, text: string, config) {
    const ocConfig = config as OpenClawConfig & { webhookSecret?: string };
    if (!ocConfig.webhookUrl) return;

    await sendNotification(
      ocConfig.webhookUrl,
      ocConfig.apiKey,
      ocConfig.webhookSecret ?? "",
      { type: "message", message: text },
    );
  },
};
