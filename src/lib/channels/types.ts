export const CHANNEL_TYPES = ["telegram", "whatsapp", "slack", "signal", "discord", "email"] as const;
export type ChannelType = (typeof CHANNEL_TYPES)[number];

export interface HelpRequestEvent {
  refCode: string;
  question?: string;
  expertName: string;
  consumerLabel?: string;
  createdAt: string;
  /**
   * Optional link back to the request in the expert dashboard.
   * Channels with strict outbound payload requirements (e.g. Discord)
   * use this to keep encrypted question text off the wire.
   */
  dashboardUrl?: string;
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

  /** Format an expert reply for delivery on this channel */
  formatReply(response: string, refCode: string): FormattedMessage;

  /** Parse an inbound reply from an expert on this channel */
  parseInboundReply(raw: unknown): { refCode: string; text: string } | null;
}
