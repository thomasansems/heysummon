import type { ChannelAdapter, SlackConfig } from "./types";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import crypto from "node:crypto";

const SLACK_API = "https://slack.com/api";

/** Call a Slack Web API method (POST with JSON body) */
async function slackPost(
  method: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; [key: string]: unknown }> {
  const res = await fetch(`${SLACK_API}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

/** Call a Slack Web API method (GET with query params) */
async function slackGet(
  method: string,
  token: string,
  params?: Record<string, string>,
): Promise<{ ok: boolean; [key: string]: unknown }> {
  const url = new URL(`${SLACK_API}/${method}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

/** Validate a Slack bot token by calling auth.test */
export async function validateBotToken(
  token: string,
): Promise<
  | { valid: true; teamId: string; teamName: string; botUserId: string }
  | { valid: false; error: string }
> {
  try {
    const data = await slackPost("auth.test", token);
    if (!data.ok) {
      return {
        valid: false,
        error: `Invalid bot token — Slack API rejected it: ${data.error ?? "unknown error"}`,
      };
    }
    return {
      valid: true,
      teamId: data.team_id as string,
      teamName: (data.team as string) ?? "",
      botUserId: data.user_id as string,
    };
  } catch {
    return { valid: false, error: "Could not reach Slack API" };
  }
}

/** Verify the bot has access to the specified channel */
export async function verifyChannelAccess(
  token: string,
  channelId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const data = await slackGet("conversations.info", token, {
      channel: channelId,
    });
    if (!data.ok) {
      if (data.error === "channel_not_found") {
        return {
          ok: false,
          error:
            "Channel not found. Make sure the bot is added to the channel and the Channel ID is correct.",
        };
      }
      return {
        ok: false,
        error: `Cannot access channel: ${data.error ?? "unknown error"}`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Slack API" };
  }
}

/** Send a text message to a Slack channel */
export async function sendMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<void> {
  const data = await slackPost("chat.postMessage", token, {
    channel: channelId,
    text,
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!data.ok) {
    throw new Error(
      `Failed to send Slack message: ${data.error ?? "unknown error"}`,
    );
  }
}

/** Send a Block Kit message with action buttons to a Slack channel */
export async function sendMessageWithBlocks(
  token: string,
  channelId: string,
  text: string,
  actions: Array<{ text: string; action_id: string; value: string; style?: "primary" | "danger" }>,
): Promise<void> {
  const blocks = [
    {
      type: "section",
      text: { type: "mrkdwn", text },
    },
    {
      type: "actions",
      elements: actions.map((a) => ({
        type: "button",
        text: { type: "plain_text", text: a.text },
        action_id: a.action_id,
        value: a.value,
        ...(a.style ? { style: a.style } : {}),
      })),
    },
  ];

  const data = await slackPost("chat.postMessage", token, {
    channel: channelId,
    text, // fallback for notifications
    blocks,
    unfurl_links: false,
    unfurl_media: false,
  });
  if (!data.ok) {
    throw new Error(
      `Failed to send Slack Block Kit message: ${data.error ?? "unknown error"}`,
    );
  }
}

/** Update an existing Slack message (used to replace buttons with decision text) */
export async function updateMessage(
  token: string,
  channelId: string,
  messageTs: string,
  text: string,
): Promise<void> {
  const data = await slackPost("chat.update", token, {
    channel: channelId,
    ts: messageTs,
    text,
    blocks: [], // remove Block Kit actions
  });
  if (!data.ok) {
    throw new Error(
      `Failed to update Slack message: ${data.error ?? "unknown error"}`,
    );
  }
}

/** Verify an incoming Slack request signature */
export function verifySlackSignature(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  signature: string,
): boolean {
  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const computed = `v0=${hmac}`;

  // timingSafeEqual requires equal-length buffers
  const computedBuf = Buffer.from(computed);
  const signatureBuf = Buffer.from(signature);
  if (computedBuf.length !== signatureBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, signatureBuf);
}

/** Send a response back to a Slack channel if the request came from Slack */
export async function sendResponseToSlack(
  requestId: string,
  responseText: string,
): Promise<boolean> {
  const request = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    include: { expertChannel: true },
  });

  if (
    !request?.expertChannelId ||
    !request.consumerChatId ||
    !request.expertChannel
  ) {
    return false;
  }

  if (request.expertChannel.type !== "slack") {
    return false;
  }

  const config = JSON.parse(request.expertChannel.config) as SlackConfig;
  await sendMessage(config.botToken, request.consumerChatId, responseText);
  return true;
}

export const slackAdapter: ChannelAdapter = {
  type: "slack",

  validateConfig(config: unknown) {
    if (!config || typeof config !== "object") {
      return { valid: false, error: "Config is required" };
    }

    const c = config as Record<string, unknown>;
    if (
      !c.botToken ||
      typeof c.botToken !== "string" ||
      c.botToken.trim().length === 0
    ) {
      return { valid: false, error: "Bot token is required" };
    }

    if (
      !c.signingSecret ||
      typeof c.signingSecret !== "string" ||
      c.signingSecret.trim().length === 0
    ) {
      return { valid: false, error: "Signing secret is required" };
    }

    if (
      !c.channelId ||
      typeof c.channelId !== "string" ||
      c.channelId.trim().length === 0
    ) {
      return { valid: false, error: "Channel ID is required" };
    }

    const validated: SlackConfig = {
      botToken: c.botToken.trim(),
      signingSecret: c.signingSecret.trim(),
      channelId: c.channelId.trim(),
      teamId: typeof c.teamId === "string" ? c.teamId : undefined,
      teamName: typeof c.teamName === "string" ? c.teamName : undefined,
      botUserId: typeof c.botUserId === "string" ? c.botUserId : undefined,
    };

    return { valid: true, config: validated };
  },

  async onActivate(channelId: string, config) {
    const slackConfig = config as SlackConfig;

    // Validate bot token
    const result = await validateBotToken(slackConfig.botToken);
    if (!result.valid) {
      throw new Error(result.error);
    }

    // Verify channel access
    const channelCheck = await verifyChannelAccess(
      slackConfig.botToken,
      slackConfig.channelId,
    );
    if (!channelCheck.ok) {
      throw new Error(channelCheck.error);
    }

    // Build the webhook URL for display in setup instructions
    const baseUrl = getPublicBaseUrl();
    const webhookUrl = `${baseUrl}/api/adapters/slack/${channelId}/webhook`;

    // Update channel with team info
    await prisma.expertChannel.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify({
          ...slackConfig,
          teamId: result.teamId,
          teamName: result.teamName,
          botUserId: result.botUserId,
        }),
        status: "connected",
        errorMessage: `Configure your Slack app Event Subscriptions Request URL to: ${webhookUrl}`,
      },
    });
  },

  async onDeactivate(_channelId: string, _config) {
    // No external cleanup needed for Slack — the app owner manages their Slack app
  },

  async sendMessage(chatId: string, text: string, config) {
    const slackConfig = config as SlackConfig;
    await sendMessage(slackConfig.botToken, chatId, text);
  },
};
