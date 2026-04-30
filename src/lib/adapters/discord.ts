import type { ChannelAdapter, DiscordConfig } from "./types";
import { prisma } from "@/lib/prisma";
import { getPublicBaseUrl } from "@/lib/public-url";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordApiResult {
  ok: boolean;
  status: number;
  data: unknown;
}

/**
 * Call the Discord REST API. Honors `Retry-After` on 429 with a single retry.
 * Returns the parsed JSON body alongside the HTTP status so callers can
 * surface Discord error payloads verbatim.
 */
async function discordApi(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  token: string,
  body?: Record<string, unknown>,
): Promise<DiscordApiResult> {
  const doFetch = async () =>
    fetch(`${DISCORD_API}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

  let res = await doFetch();

  if (res.status === 429) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : 1;
    const waitMs = Math.min(
      Math.max(Number.isFinite(retryAfterSec) ? retryAfterSec : 1, 0.1) * 1000,
      10_000,
    );
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    res = await doFetch();
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  return { ok: res.ok, status: res.status, data };
}

function discordErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.message === "string" && d.message.length > 0) {
      const code = typeof d.code === "number" ? ` (code ${d.code})` : "";
      return `${d.message}${code}`;
    }
  }
  if (typeof data === "string" && data.length > 0) return data;
  return fallback;
}

/** Validate a Discord bot token by calling `GET /users/@me`. */
export async function validateBotToken(
  token: string,
): Promise<
  | { valid: true; botUserId: string }
  | { valid: false; error: string }
> {
  try {
    const res = await discordApi("GET", "/users/@me", token);
    if (!res.ok) {
      return {
        valid: false,
        error: `Invalid bot token — Discord API rejected it: ${discordErrorMessage(res.data, `HTTP ${res.status}`)}`,
      };
    }
    const data = res.data as { id?: unknown } | null;
    const botUserId = data && typeof data.id === "string" ? data.id : "";
    if (!botUserId) {
      return { valid: false, error: "Discord did not return a bot user id" };
    }
    return { valid: true, botUserId };
  } catch {
    return { valid: false, error: "Could not reach Discord API" };
  }
}

/**
 * Verify the bot can see a guild text channel and that the channel belongs
 * to the configured guild.
 *
 * Discord channel `type === 0` is GUILD_TEXT.
 */
export async function verifyChannelAccess(
  token: string,
  channelId: string,
  guildId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await discordApi("GET", `/channels/${channelId}`, token);
    if (!res.ok) {
      if (res.status === 404) {
        return {
          ok: false,
          error:
            "Channel not found. Make sure the bot has been added to the server and the Channel ID is correct.",
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          error:
            "The bot does not have permission to view this channel. Grant it View Channel + Send Messages.",
        };
      }
      return {
        ok: false,
        error: `Cannot access channel: ${discordErrorMessage(res.data, `HTTP ${res.status}`)}`,
      };
    }

    const data = res.data as
      | { type?: unknown; guild_id?: unknown }
      | null;

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Discord returned an unexpected channel payload" };
    }

    if (data.type !== 0) {
      return {
        ok: false,
        error: "Channel must be a server text channel (GUILD_TEXT). DMs and other channel types are not supported.",
      };
    }

    if (typeof data.guild_id !== "string" || data.guild_id !== guildId) {
      return {
        ok: false,
        error: "Channel does not belong to the configured Discord server (guild_id mismatch).",
      };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Discord API" };
  }
}

/**
 * Send a plain text message to a Discord channel.
 *
 * `allowed_mentions.parse = []` is set so the bot cannot ping `@everyone`,
 * `@here`, or arbitrary roles even if the rendered content contains those tokens.
 */
export async function sendMessage(
  token: string,
  channelId: string,
  text: string,
): Promise<void> {
  const res = await discordApi("POST", `/channels/${channelId}/messages`, token, {
    content: text,
    allowed_mentions: { parse: [] },
  });
  if (!res.ok) {
    throw new Error(
      `Failed to send Discord message: ${discordErrorMessage(res.data, `HTTP ${res.status}`)}`,
    );
  }
}

export interface DiscordButton {
  /** Button label visible to the user. Max 80 chars per Discord. */
  label: string;
  /** Opaque payload returned in the interaction (max 100 chars). */
  customId: string;
  /**
   * Discord button style id. 1=primary, 2=secondary, 3=success, 4=danger, 5=link.
   * Defaults to 2 (secondary).
   */
  style?: 1 | 2 | 3 | 4;
}

/**
 * Send a Discord message with a single action row of buttons.
 * Mirrors `sendMessageWithBlocks` from the Slack adapter; component schema
 * follows the Discord components-v2 contract.
 */
export async function sendMessageWithComponents(
  token: string,
  channelId: string,
  text: string,
  buttons: DiscordButton[],
): Promise<void> {
  const components = [
    {
      type: 1, // ACTION_ROW
      components: buttons.map((b) => ({
        type: 2, // BUTTON
        style: b.style ?? 2,
        label: b.label,
        custom_id: b.customId,
      })),
    },
  ];

  const res = await discordApi("POST", `/channels/${channelId}/messages`, token, {
    content: text,
    allowed_mentions: { parse: [] },
    components,
  });
  if (!res.ok) {
    throw new Error(
      `Failed to send Discord components message: ${discordErrorMessage(res.data, `HTTP ${res.status}`)}`,
    );
  }
}

/** Send a response back to a Discord channel that originated a help request. */
export async function sendResponseToDiscord(
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

  if (request.expertChannel.type !== "discord") {
    return false;
  }

  const config = JSON.parse(request.expertChannel.config) as DiscordConfig;
  await sendMessage(config.botToken, request.consumerChatId, responseText);
  return true;
}

export const discordAdapter: ChannelAdapter = {
  type: "discord",

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
      !c.applicationId ||
      typeof c.applicationId !== "string" ||
      c.applicationId.trim().length === 0
    ) {
      return { valid: false, error: "Application ID is required" };
    }

    if (
      !c.publicKey ||
      typeof c.publicKey !== "string" ||
      c.publicKey.trim().length === 0
    ) {
      return { valid: false, error: "Public key is required" };
    }

    if (
      !c.guildId ||
      typeof c.guildId !== "string" ||
      c.guildId.trim().length === 0
    ) {
      return { valid: false, error: "Guild ID is required" };
    }

    if (
      !c.channelId ||
      typeof c.channelId !== "string" ||
      c.channelId.trim().length === 0
    ) {
      return { valid: false, error: "Channel ID is required" };
    }

    const validated: DiscordConfig = {
      botToken: c.botToken.trim(),
      applicationId: c.applicationId.trim(),
      publicKey: c.publicKey.trim(),
      guildId: c.guildId.trim(),
      channelId: c.channelId.trim(),
      botUserId: typeof c.botUserId === "string" ? c.botUserId : undefined,
    };

    return { valid: true, config: validated };
  },

  async onActivate(channelId: string, config) {
    const discordConfig = config as DiscordConfig;

    const tokenResult = await validateBotToken(discordConfig.botToken);
    if (!tokenResult.valid) {
      throw new Error(tokenResult.error);
    }

    const channelCheck = await verifyChannelAccess(
      discordConfig.botToken,
      discordConfig.channelId,
      discordConfig.guildId,
    );
    if (!channelCheck.ok) {
      throw new Error(channelCheck.error);
    }

    const baseUrl = getPublicBaseUrl();
    const webhookUrl = `${baseUrl}/api/adapters/discord/${channelId}/webhook`;

    await prisma.expertChannel.update({
      where: { id: channelId },
      data: {
        config: JSON.stringify({
          ...discordConfig,
          botUserId: tokenResult.botUserId,
        }),
        status: "connected",
        errorMessage: `Set your Discord application Interactions Endpoint URL to: ${webhookUrl}`,
      },
    });
  },

  async onDeactivate(_channelId: string, _config) {
    // No external cleanup — the operator manages their Discord application directly.
  },

  async sendMessage(chatId: string, text: string, config) {
    const discordConfig = config as DiscordConfig;
    await sendMessage(discordConfig.botToken, chatId, text);
  },
};
