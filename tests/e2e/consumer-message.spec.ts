/**
 * Consumer message E2E test
 *
 * Tests that consumers can send messages and that the message flow
 * respects the state machine (can't send to closed/expired requests).
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost, apiRaw } from "./helpers/api";
import { PW } from "./helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.CLIENT_KEY };
const EXPERT_HEADERS = { "x-api-key": PW.EXPERT_KEY };

test.describe("Consumer message flow", () => {
  let requestId: string;

  test("1. Submit request", async () => {
    const data = await apiPost<{ requestId: string; status: string }>(
      "/api/v1/help",
      {
        apiKey: PW.CLIENT_KEY,
        question: "Consumer message test — automated E2E",
        signPublicKey: "cm-test-sign",
        encryptPublicKey: "cm-test-encrypt",
      }
    );
    expect(data.requestId).toBeTruthy();
    requestId = data.requestId;
  });

  test("2. Consumer sends a message (plaintext)", async () => {
    const data = await apiPost<{ success: boolean; messageId: string }>(
      `/api/v1/message/${requestId}`,
      { from: "consumer", plaintext: "Follow-up from consumer" },
      CONSUMER_HEADERS
    );
    expect(data.success).toBe(true);
    expect(data.messageId).toBeTruthy();
  });

  test("3. Expert responds", async () => {
    const data = await apiPost<{ success: boolean }>(
      `/api/v1/message/${requestId}`,
      { from: "expert", plaintext: "Expert reply to consumer" },
      EXPERT_HEADERS
    );
    expect(data.success).toBe(true);
  });

  test("4. Request status is responded after expert message", async () => {
    const data = await apiGet<{ requestId: string; status: string }>(
      `/api/v1/help/${requestId}`,
      CONSUMER_HEADERS
    );
    expect(data.status).toBe("responded");
  });

  test("5. Consumer can still send messages after expert responded", async () => {
    const data = await apiPost<{ success: boolean }>(
      `/api/v1/message/${requestId}`,
      { from: "consumer", plaintext: "Consumer follow-up after response" },
      CONSUMER_HEADERS
    );
    expect(data.success).toBe(true);
  });

  test("6. Close the request", async () => {
    const data = await apiPost<{ success: boolean; status: string }>(
      `/api/v1/close/${requestId}`,
      {},
      CONSUMER_HEADERS
    );
    expect(data.success).toBe(true);
    expect(data.status).toBe("closed");
  });

  test("7. Cannot send message to closed request", async () => {
    const res = await apiRaw(
      "POST",
      `/api/v1/message/${requestId}`,
      { from: "consumer", plaintext: "Should fail" },
      CONSUMER_HEADERS
    );
    expect(res.status).toBe(400);
  });
});
