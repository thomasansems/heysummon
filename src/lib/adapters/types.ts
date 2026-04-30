export interface OpenClawConfig {
  apiKey: string;
  webhookUrl?: string;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  webhookSecret?: string;
  /** One-time token the expert must include in /start to bind their chat */
  setupToken?: string;
  /** The expert's own Telegram chat ID (captured when they send /start) */
  expertChatId?: string;
}

export interface SlackConfig {
  botToken: string;
  signingSecret: string;
  channelId: string;
  teamId?: string;
  teamName?: string;
  botUserId?: string;
}

export interface DiscordConfig {
  botToken: string;
  applicationId: string;
  publicKey: string;
  guildId: string;
  channelId: string;
  botUserId?: string;
}

export type ChannelType = "openclaw" | "telegram" | "slack" | "discord";

export type ChannelConfig =
  | OpenClawConfig
  | TelegramConfig
  | SlackConfig
  | DiscordConfig;

export interface ChannelAdapter {
  type: ChannelType;
  validateConfig(config: unknown): { valid: true; config: ChannelConfig } | { valid: false; error: string };
  onActivate?(channelId: string, config: ChannelConfig): Promise<void>;
  onDeactivate?(channelId: string, config: ChannelConfig): Promise<void>;
  sendMessage?(chatId: string, text: string, config: ChannelConfig): Promise<void>;
}
