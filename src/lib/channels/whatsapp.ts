import type { ChannelAdapter, HelpRequestEvent, FormattedMessage } from "./types";

/**
 * WhatsApp channel adapter.
 *
 * WhatsApp formatting uses its own markdown variant:
 *   *bold*  _italic_  ~strikethrough~  ```code```  `inline code`
 *
 * Key constraints:
 * - Max message: 4096 characters
 * - 24-hour messaging window: after the last user message, you have 24h
 *   to send free-form messages. Outside the window, you must use pre-approved
 *   template messages (handled at the delivery layer, not here).
 * - No HTML parse mode — plain text with WhatsApp markdown.
 */
export const whatsappAdapter: ChannelAdapter = {
  type: "whatsapp",
  supportsRichMedia: true,
  maxMessageLength: 4096,

  formatNotification(event: HelpRequestEvent): FormattedMessage {
    const lines = [
      `*New help request*`,
      ``,
      `*Ref:* \`${event.refCode}\``,
      `*Provider:* ${event.providerName}`,
    ];

    if (event.consumerLabel) {
      lines.push(`*From:* ${event.consumerLabel}`);
    }

    if (event.question) {
      lines.push(``, `*Question:*`, event.question);
    }

    lines.push(``, `Reply with: \`/reply ${event.refCode} your answer\``);

    return { text: lines.join("\n") };
  },

  formatReply(response: string, refCode: string): FormattedMessage {
    const lines = [
      `*Reply sent* for \`${refCode}\``,
      ``,
      response,
    ];

    return { text: lines.join("\n") };
  },

  parseInboundReply(raw: unknown): { refCode: string; text: string } | null {
    if (!raw || typeof raw !== "object") return null;
    const msg = raw as Record<string, unknown>;

    // WhatsApp webhook payloads nest text differently depending on the
    // integration (Twilio, Meta Cloud API, OpenClaw, etc.).
    // We support a flat { text } shape and the Meta Cloud API shape.
    let text: string | undefined;

    if (typeof msg.text === "string") {
      text = msg.text;
    } else if (typeof msg.body === "string") {
      text = msg.body;
    }

    if (!text) return null;

    const match = text.match(/^\/reply\s+(HS-[A-Za-z0-9]+)\s+(.+)/i);
    if (!match) return null;

    return { refCode: match[1].toUpperCase(), text: match[2].trim() };
  },
};
