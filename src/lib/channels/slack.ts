import type { ChannelAdapter, HelpRequestEvent, FormattedMessage } from "./types";

/**
 * Slack channel adapter.
 *
 * Slack uses mrkdwn (their own Markdown variant):
 *   *bold*  _italic_  ~strikethrough~  `code`  ```code block```
 *   Links: <https://example.com|display text>
 *
 * Max message length: 4000 characters (Block Kit) or 40000 (plain text).
 * We use plain text with mrkdwn formatting for simplicity.
 */
export const slackAdapter: ChannelAdapter = {
  type: "slack",
  supportsRichMedia: true,
  maxMessageLength: 4000,

  formatNotification(event: HelpRequestEvent): FormattedMessage {
    const lines = [
      `*New help request*`,
      ``,
      `*Ref:* \`${event.refCode}\``,
      `*Expert:* ${escapeSlack(event.expertName)}`,
    ];

    if (event.consumerLabel) {
      lines.push(`*From:* ${escapeSlack(event.consumerLabel)}`);
    }

    if (event.question) {
      lines.push(``, `*Question:*`, escapeSlack(event.question));
    }

    lines.push(``, `Reply with: \`reply ${event.refCode} your answer\``);

    return { text: lines.join("\n") };
  },

  formatReply(response: string, refCode: string): FormattedMessage {
    const lines = [
      `*Reply sent* for \`${refCode}\``,
      ``,
      escapeSlack(response),
    ];

    return { text: lines.join("\n") };
  },

  parseInboundReply(raw: unknown): { refCode: string; text: string } | null {
    if (!raw || typeof raw !== "object") return null;
    const msg = raw as Record<string, unknown>;
    const rawText = typeof msg.text === "string" ? msg.text : "";
    // Strip surrounding backticks — Slack sends these when users copy from code-formatted text
    const text = rawText.trim().replace(/^`+|`+$/g, "").trim();

    // Match: reply HS-XXXX some answer text (no slash — Slack intercepts / as commands)
    const match = text.match(/^reply\s+(HS-[A-Za-z0-9]+)\s+(.+)/i);
    if (!match) return null;

    return { refCode: match[1].toUpperCase(), text: match[2].trim() };
  },
};

/** Escape special Slack mrkdwn characters */
export function escapeSlack(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
