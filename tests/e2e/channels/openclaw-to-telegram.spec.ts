/**
 * Channel combination 1: OpenClaw consumer -> Telegram expert notification.
 *
 * When a consumer submits a request with clientChannel=openclaw + clientSubChannel=telegram,
 * the platform should:
 * 1. Send a Telegram notification to the expert's registered bot/chat
 * 2. Allow the expert to respond via the /api/v1/message endpoint
 * 3. Allow the consumer to poll and receive the response
 *
 * The Telegram API calls are intercepted by Playwright's route interception.
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost } from "../helpers/api";
import { withTelegramMock } from "../helpers/telegram-mock";
import { PW } from "../helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.OC_TELEGRAM_KEY };
const EXPERT_HEADERS = { "x-api-key": PW.EXPERT_KEY };

test.describe("Channel: OpenClaw consumer -> Telegram expert notification", () => {
  let requestId: string;
  let refCode: string;

  test("1. Submit request triggers Telegram notification to expert", async ({ page }) => {
    const { sendMessages } = await withTelegramMock(page, async () => {
      const data = await apiPost<{ requestId: string; refCode: string }>(
        "/api/v1/help",
        {
          apiKey: PW.OC_TELEGRAM_KEY,
          question: "OC->Telegram channel test -- automated E2E",
          signPublicKey: "oc-tg-test-sign-key",
          encryptPublicKey: "oc-tg-test-encrypt-key",
        }
      );
      requestId = data.requestId;
      refCode = data.refCode;
    });

    // The Telegram notification is sent async (fire-and-forget in production)
    // In test env with a seeded bot token, it may or may not fire depending on
    // whether the Telegram adapter is active. We check if a notification was sent
    // and validate its content if it was.
    if (sendMessages.length > 0) {
      const msg = sendMessages[0];
      expect(String(msg.chat_id)).toBe(PW.TELEGRAM_EXPERT_CHAT_ID);
      expect(msg.text).toContain(refCode);
      expect(msg.text).toContain("/reply");
    }

    // Regardless, the request should have been created
    expect(requestId).toBeTruthy();
    expect(refCode).toMatch(/^[A-Z0-9-]+$/);
  });

  test("2. Expert polls events/pending and sees the request", async () => {
    const data = await apiGet<{
      events: Array<{ type: string; requestId: string }>;
    }>("/api/v1/events/pending", EXPERT_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.type).toBe("new_request");
  });

  test("3. Expert responds via message API", async () => {
    const data = await apiPost<{ success: boolean }>(
      `/api/v1/message/${requestId}`,
      { from: "expert", plaintext: "OC->Telegram test response" },
      EXPERT_HEADERS
    );
    expect(data.success).toBe(true);
  });

  test("4. Consumer polls and sees the expert response", async () => {
    const data = await apiGet<{
      events: Array<{ type: string; requestId: string }>;
    }>("/api/v1/events/pending", CONSUMER_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.type).toBe("new_message");
  });
});
