import type { ChannelAdapter, TelegramConfig } from "./types";
import { prisma } from "@/lib/prisma";
import crypto from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";

function botUrl(token: string, method: string): string {
  return `${TELEGRAM_API}/bot${token}/${method}`;
}

/** Validate a Telegram bot token by calling getMe */
export async function validateBotToken(token: string): Promise<{ valid: true; username: string } | { valid: false; error: string }> {
  try {
    const res = await fetch(botUrl(token, "getMe"));
    if (!res.ok) {
      return { valid: false, error: "Invalid bot token — Telegram API rejected it" };
    }
    const data = await res.json();
    if (!data.ok || !data.result?.username) {
      return { valid: false, error: "Invalid bot token — could not retrieve bot info" };
    }
    return { valid: true, username: data.result.username };
  } catch {
    return { valid: false, error: "Could not reach Telegram API" };
  }
}

/** Set the webhook for a Telegram bot */
export async function setWebhook(token: string, webhookUrl: string, secret: string): Promise<void> {
  const res = await fetch(botUrl(token, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set Telegram webhook: ${text}`);
  }
}

/** Remove the webhook for a Telegram bot */
export async function deleteWebhook(token: string): Promise<void> {
  const res = await fetch(botUrl(token, "deleteWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete Telegram webhook: ${text}`);
  }
}

/** Send a text message via Telegram bot API */
export async function sendMessage(token: string, chatId: string, text: string): Promise<void> {
  const res = await fetch(botUrl(token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send Telegram message: ${body}`);
  }
}

/** Send a response back to a Telegram chat if the request came from Telegram */
export async function sendResponseToTelegram(requestId: string, responseText: string): Promise<boolean> {
  const request = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    include: { channelProvider: true },
  });

  if (!request?.channelProviderId || !request.consumerChatId || !request.channelProvider) {
    return false;
  }

  if (request.channelProvider.type !== "telegram") {
    return false;
  }

  const config = JSON.parse(request.channelProvider.config) as TelegramConfig;
  await sendMessage(config.botToken, request.consumerChatId, responseText);
  return true;
}

export const telegramAdapter: ChannelAdapter = {
  type: "telegram",

  validateConfig(config: unknown) {
    if (!config || typeof config !== "object") {
      return { valid: false, error: "Config is required" };
    }

    const c = config as Record<string, unknown>;
    if (!c.botToken || typeof c.botToken !== "string" || c.botToken.trim().length === 0) {
      return { valid: false, error: "Bot token is required" };
    }

    const validated: TelegramConfig = {
      botToken: c.botToken.trim(),
      botUsername: typeof c.botUsername === "string" ? c.botUsername : undefined,
      webhookSecret: typeof c.webhookSecret === "string" ? c.webhookSecret : undefined,
    };

    return { valid: true, config: validated };
  },

  async onActivate(channelId: string, config) {
    const tgConfig = config as TelegramConfig;

    // Validate bot token
    const result = await validateBotToken(tgConfig.botToken);
    if (!result.valid) {
      throw new Error(result.error);
    }

    // Generate webhook secret
    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const webhookUrl = `${baseUrl}/api/adapters/telegram/${channelId}/webhook`;

    // Set webhook
    await setWebhook(tgConfig.botToken, webhookUrl, webhookSecret);

    // Update channel with bot username and webhook secret
    await prisma.channelProvider.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify({
          ...tgConfig,
          botUsername: result.username,
          webhookSecret,
        }),
        status: "connected",
      },
    });
  },

  async onDeactivate(_channelId: string, config) {
    const tgConfig = config as TelegramConfig;
    try {
      await deleteWebhook(tgConfig.botToken);
    } catch {
      // Non-fatal on delete
    }
  },

  async sendMessage(chatId: string, text: string, config) {
    const tgConfig = config as TelegramConfig;
    await sendMessage(tgConfig.botToken, chatId, text);
  },
};
