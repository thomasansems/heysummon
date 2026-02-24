export interface OpenClawConfig {
  apiKey: string;
  webhookUrl?: string;
}

export interface TelegramConfig {
  botToken: string;
  botUsername?: string;
  webhookSecret?: string;
}

export type ChannelType = "openclaw" | "telegram";

export type ChannelConfig = OpenClawConfig | TelegramConfig;

export interface ChannelAdapter {
  type: ChannelType;
  validateConfig(config: unknown): { valid: true; config: ChannelConfig } | { valid: false; error: string };
  onActivate?(channelId: string, config: ChannelConfig): Promise<void>;
  onDeactivate?(channelId: string, config: ChannelConfig): Promise<void>;
  sendMessage?(chatId: string, text: string, config: ChannelConfig): Promise<void>;
}
