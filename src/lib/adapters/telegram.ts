import type { ChannelAdapter, TelegramConfig } from "./types";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";
import crypto from "node:crypto";

const TELEGRAM_API = "https://api.telegram.org";

/**
 * Escape special characters for Telegram Markdown parse mode.
 * Prevents user-supplied content from being rendered as formatting
 * (mitigates Lies-in-the-Loop / HITL dialog forging attacks).
 */
export function escapeTelegramMarkdown(str: string): string {
  return str
    .replace(/\\/g, "\\\\")
    .replace(/\*/g, "\\*")
    .replace(/_/g, "\\_")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[");
}

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
      allowed_updates: ["message", "callback_query"],
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.ok) {
    throw new Error(data.description ?? `Failed to set Telegram webhook: HTTP ${res.status}`);
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

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;
// Leave headroom so the splitter can break on a newline without overshooting.
const TELEGRAM_CHUNK_LIMIT = 3900;

function splitForTelegram(text: string, limit = TELEGRAM_CHUNK_LIMIT): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > limit) {
    let cut = remaining.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = remaining.lastIndexOf(" ", limit);
    if (cut < limit / 2) cut = limit;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\s+/, "");
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

/**
 * Send a possibly-long message, splitting into multiple Telegram messages
 * if it exceeds the 4096 char per-message limit.
 */
export async function sendLongMessage(token: string, chatId: string, text: string): Promise<void> {
  const parts = splitForTelegram(text);
  for (const part of parts) {
    await sendMessage(token, chatId, part);
  }
}

export { TELEGRAM_MAX_MESSAGE_LENGTH, TELEGRAM_CHUNK_LIMIT };

/** Send a photo via Telegram bot API */
export async function sendPhoto(
  token: string,
  chatId: string,
  photoUrl: string,
  caption?: string
): Promise<void> {
  const res = await fetch(botUrl(token, "sendPhoto"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send Telegram photo: ${body}`);
  }
}

/** Send a message with InlineKeyboardMarkup buttons */
export async function sendMessageWithButtons(
  token: string,
  chatId: string,
  text: string,
  buttons: Array<Array<{ text: string; callback_data: string }>>
): Promise<void> {
  const res = await fetch(botUrl(token, "sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: buttons,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to send Telegram message with buttons: ${body}`);
  }
}

/** Answer a callback query (acknowledges a button press) */
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string
): Promise<void> {
  const res = await fetch(botUrl(token, "answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to answer callback query: ${body}`);
  }
}

/** Edit a message's text (also removes inline keyboard when no reply_markup is provided) */
export async function editMessageText(
  token: string,
  chatId: string,
  messageId: number,
  text: string
): Promise<void> {
  const res = await fetch(botUrl(token, "editMessageText"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: "Markdown",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to edit Telegram message: ${body}`);
  }
}

/** Send a response back to a Telegram chat if the request came from Telegram */
export async function sendResponseToTelegram(requestId: string, responseText: string): Promise<boolean> {
  const request = await prisma.helpRequest.findUnique({
    where: { id: requestId },
    include: { expertChannel: true },
  });

  if (!request?.expertChannelId || !request.consumerChatId || !request.expertChannel) {
    return false;
  }

  if (request.expertChannel.type !== "telegram") {
    return false;
  }

  const config = JSON.parse(request.expertChannel.config) as TelegramConfig;
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

    // Generate webhook secret and setup token for /start auth
    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const setupToken = crypto.randomBytes(16).toString("hex");
    // Use canonical public URL (Tailscale Funnel / Cloudflare / HEYSUMMON_PUBLIC_URL)
    // NEVER use localtunnel — use `tailscale funnel 3425` instead
    const baseUrl = getPublicBaseUrl();
    const webhookUrl = `${baseUrl}/api/adapters/telegram/${channelId}/webhook`;

    // Set webhook
    await setWebhook(tgConfig.botToken, webhookUrl, webhookSecret);

    // Update channel with bot username, webhook secret, and setup token
    await prisma.expertChannel.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify({
          ...tgConfig,
          botUsername: result.username,
          webhookSecret,
          setupToken,
        }),
        status: "awaiting_start",
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
