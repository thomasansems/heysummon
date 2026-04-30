import type { ChannelAdapter, HelpRequestEvent, FormattedMessage } from "./types";

/**
 * Discord channel adapter (formatter).
 *
 * Outbound rendering for a help request is intentionally minimal:
 * `refCode`, a short summary, and a link back to the dashboard. No plaintext
 * question payload — the encrypted body decrypts in the dashboard, never on
 * the wire. This matches the platform's E2E-encryption guarantee.
 *
 * Discord supports CommonMark-ish Markdown:
 *   **bold**  *italic*  `code`  ```code block```
 *   Links: [text](https://example.com)
 *
 * Max message length: 2000 characters for plain content.
 */
export const discordAdapter: ChannelAdapter = {
  type: "discord",
  supportsRichMedia: true,
  maxMessageLength: 2000,

  formatNotification(event: HelpRequestEvent): FormattedMessage {
    const summary = buildSummary(event);

    const lines = [
      `**New help request** \`${escapeDiscord(event.refCode)}\``,
      summary,
    ];

    if (event.dashboardUrl) {
      lines.push(`[Open in dashboard](${event.dashboardUrl})`);
    }

    return { text: lines.filter(Boolean).join("\n") };
  },

  formatReply(response: string, refCode: string): FormattedMessage {
    const lines = [
      `**Reply sent** for \`${escapeDiscord(refCode)}\``,
      ``,
      escapeDiscord(response),
    ];

    return { text: lines.join("\n") };
  },

  parseInboundReply(raw: unknown): { refCode: string; text: string } | null {
    if (!raw || typeof raw !== "object") return null;
    const msg = raw as Record<string, unknown>;
    const text = typeof msg.text === "string" ? msg.text : "";

    const match = text.match(/^reply\s+(HS-[A-Za-z0-9]+)\s+(.+)/i);
    if (!match) return null;

    return { refCode: match[1].toUpperCase(), text: match[2].trim() };
  },
};

/**
 * Build a one-line summary safe to send to Discord.
 *
 * Prefers the consumer label and a short hint of who is being asked. We never
 * forward the (potentially encrypted) question body in the outbound message —
 * the dashboard link carries the expert into the decrypted view.
 */
function buildSummary(event: HelpRequestEvent): string {
  const parts: string[] = [];
  if (event.consumerLabel) {
    parts.push(`From ${escapeDiscord(event.consumerLabel)}`);
  }
  parts.push(`for ${escapeDiscord(event.expertName)}`);
  return parts.join(" ");
}

/**
 * Escape Discord Markdown control characters. Discord does not have an
 * official escape set; backslash-escaping these covers the common cases
 * (`*`, `_`, `~`, ``` ` ```, `>`, `|`, `\`, and `@` for mentions).
 */
export function escapeDiscord(str: string): string {
  return str.replace(/[\\*_~`>|@]/g, "\\$&");
}
