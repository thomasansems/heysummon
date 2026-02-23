import type { ChannelAdapter, HelpRequestEvent, FormattedMessage } from "./types";

/**
 * Telegram channel adapter.
 *
 * Telegram Bot API supports HTML and MarkdownV2 parse modes.
 * We use HTML because it's easier to construct programmatically
 * and avoids the aggressive escaping MarkdownV2 requires.
 *
 * Max message length: 4096 characters.
 */
export const telegramAdapter: ChannelAdapter = {
  type: "telegram",
  supportsRichMedia: true,
  maxMessageLength: 4096,

  formatNotification(event: HelpRequestEvent): FormattedMessage {
    const lines = [
      `<b>New help request</b>`,
      ``,
      `<b>Ref:</b> <code>${escapeHtml(event.refCode)}</code>`,
      `<b>Provider:</b> ${escapeHtml(event.providerName)}`,
    ];

    if (event.consumerLabel) {
      lines.push(`<b>From:</b> ${escapeHtml(event.consumerLabel)}`);
    }

    if (event.question) {
      lines.push(``, `<b>Question:</b>`, escapeHtml(event.question));
    }

    lines.push(``, `Reply with <code>/reply ${escapeHtml(event.refCode)} your answer</code>`);

    return { text: lines.join("\n"), parseMode: "HTML" };
  },

  formatReply(response: string, refCode: string): FormattedMessage {
    const lines = [
      `<b>Reply sent</b> for <code>${escapeHtml(refCode)}</code>`,
      ``,
      escapeHtml(response),
    ];

    return { text: lines.join("\n"), parseMode: "HTML" };
  },

  parseInboundReply(raw: unknown): { refCode: string; text: string } | null {
    if (!raw || typeof raw !== "object") return null;
    const msg = raw as Record<string, unknown>;
    const text = typeof msg.text === "string" ? msg.text : "";

    // Match: /reply HS-XXXX some answer text
    const match = text.match(/^\/reply\s+(HS-[A-Za-z0-9]+)\s+(.+)/i);
    if (!match) return null;

    return { refCode: match[1].toUpperCase(), text: match[2].trim() };
  },
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
