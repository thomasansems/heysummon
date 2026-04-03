import type { Page, Route } from "@playwright/test";

export interface TelegramSendMessagePayload {
  chat_id: string | number;
  text: string;
  parse_mode?: string;
  reply_markup?: unknown;
}

/**
 * Intercepts all calls to the Telegram Bot API via Playwright's network routing.
 * Captures outbound sendMessage payloads and returns them for assertion.
 *
 * Usage:
 *   const captured = await withTelegramMock(page, async () => {
 *     // ... action that triggers Telegram notification
 *   });
 *   expect(captured.sendMessages[0].text).toContain("HS-");
 */
export async function withTelegramMock(
  page: Page,
  fn: () => Promise<void>
): Promise<{ sendMessages: TelegramSendMessagePayload[] }> {
  const sendMessages: TelegramSendMessagePayload[] = [];

  await page.route("https://api.telegram.org/**", async (route: Route) => {
    const url = route.request().url();
    if (url.includes("/sendMessage")) {
      const postData = route.request().postDataJSON() as TelegramSendMessagePayload | null;
      if (postData) {
        sendMessages.push(postData);
      }
      // Return success response
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          result: {
            message_id: Math.floor(Math.random() * 10000),
            chat: { id: postData?.chat_id ?? 0 },
            text: postData?.text ?? "",
          },
        }),
      });
    } else {
      // Allow other Telegram API calls through (or mock them)
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }
  });

  await fn();

  // Small delay to allow async Telegram calls to complete
  await new Promise((r) => setTimeout(r, 500));

  return { sendMessages };
}

/**
 * Simulates a Telegram webhook callback (e.g. /reply HS-XXXX answer from expert).
 * Calls the local /api/adapters/telegram/[id]/webhook endpoint directly.
 */
export async function simulateTelegramReply({
  baseUrl,
  channelId,
  secretToken,
  fromChatId,
  text,
}: {
  baseUrl: string;
  channelId: string;
  secretToken: string;
  fromChatId: string;
  text: string;
}): Promise<Response> {
  const update = {
    update_id: Math.floor(Math.random() * 1_000_000),
    message: {
      message_id: Math.floor(Math.random() * 10000),
      from: { id: parseInt(fromChatId), is_bot: false, first_name: "Test", username: "testexpert" },
      chat: { id: parseInt(fromChatId), type: "private" },
      date: Math.floor(Date.now() / 1000),
      text,
    },
  };

  return fetch(`${baseUrl}/api/adapters/telegram/${channelId}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-bot-api-secret-token": secretToken,
    },
    body: JSON.stringify(update),
  });
}
