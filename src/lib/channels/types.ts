export const CHANNEL_TYPES = ["telegram", "whatsapp", "signal", "discord", "email"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface HelpRequestEvent {
  refCode: string;
  question?: string;
  providerName: string;
  consumerLabel?: string;
  createdAt: string;
}

export interface FormattedMessage {
  text: string;
  parseMode?: string; // e.g. "HTML", "MarkdownV2" for Telegram
}

export interface ChannelAdapter {
  type: ChannelType;
  supportsRichMedia: boolean;
  maxMessageLength: number;

  /** Format a new help-request notification for delivery on this channel */
  formatNotification(event: HelpRequestEvent): FormattedMessage;

  /** Format a provider reply for delivery on this channel */
  formatReply(response: string, refCode: string): FormattedMessage;

  /** Parse an inbound reply from a provider on this channel */
  parseInboundReply(raw: unknown): { refCode: string; text: string } | null;
}
