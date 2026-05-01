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

export const QUERY_ACTIONS = ["approve", "deny", "ack"] as const;
export type QueryAction = (typeof QUERY_ACTIONS)[number];

function isQueryAction(value: string): value is QueryAction {
  return (QUERY_ACTIONS as readonly string[]).includes(value);
}

/**
 * Compute the HMAC-SHA256 signature embedded in action URLs.
 * The signature binds the action and requestId so query-param callbacks
 * cannot be forged or replayed across requests.
 */
export function signQueryAction(
  webhookSecret: string,
  action: QueryAction,
  requestId: string,
): string {
  return crypto
    .createHmac("sha256", webhookSecret)
    .update(`${action}:${requestId}`)
    .digest("hex");
}

/** Constant-time verify the action URL signature. Returns false if the secret is empty. */
export function verifyQueryActionSignature(
  webhookSecret: string,
  action: string,
  requestId: string,
  signature: string,
): boolean {
  if (!webhookSecret || !signature) return false;
  if (!isQueryAction(action)) return false;
  const expected = signQueryAction(webhookSecret, action, requestId);
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(signature);
  if (expectedBuf.length !== sigBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, sigBuf);
}

/**
 * Send a notification with one or more action URLs.
 *
 * `actions` is an ordered list of `{ id, label }` pairs. Each `id` becomes a
 * key in the wire-format `actions` map (`{ [id]: signedUrl }`) so existing
 * OpenClaw integrations that read `payload.actions.approve` keep working;
 * `actionLabels` exposes the human label for renderers.
 */
export async function sendNotificationWithActions(
  webhookUrl: string,
  apiKey: string,
  webhookSecret: string,
  callbackBaseUrl: string,
  payload: {
    requestId: string;
    refCode: string;
    message: string;
    type?: string;
    actions: Array<{ id: QueryAction; label: string }>;
  },
): Promise<void> {
  const actions: Record<string, string> = {};
  const actionLabels: Record<string, string> = {};
  for (const a of payload.actions) {
    const sig = signQueryAction(webhookSecret, a.id, payload.requestId);
    actions[a.id] =
      `${callbackBaseUrl}?action=${a.id}&requestId=${encodeURIComponent(payload.requestId)}&sig=${sig}`;
    actionLabels[a.id] = a.label;
  }

  await sendNotification(webhookUrl, apiKey, webhookSecret, {
    type: payload.type ?? "approval_required",
    requestId: payload.requestId,
    refCode: payload.refCode,
    message: payload.message,
    actions,
    actionLabels,
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
    await prisma.expertChannel.update({
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
