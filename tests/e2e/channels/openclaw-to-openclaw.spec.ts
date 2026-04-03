/**
 * Channel combination 2: OpenClaw consumer -> OpenClaw expert notification (pure polling path).
 *
 * Tests the "no external webhook" scenario where both consumer and expert use polling.
 * This is the simplest channel combination and validates the core polling mechanics.
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost } from "../helpers/api";
import { PW } from "../helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.OC_OPENCLAW_KEY };
const EXPERT_HEADERS = { "x-api-key": PW.EXPERT_KEY };

test.describe("Channel: OpenClaw consumer -> OpenClaw expert (pure polling)", () => {
  let requestId: string;
  let refCode: string;

  test("1. Consumer submits help request (openclaw channel)", async () => {
    const data = await apiPost<{ requestId: string; refCode: string; status: string }>(
      "/api/v1/help",
      {
        apiKey: PW.OC_OPENCLAW_KEY,
        question: "OC->OC channel test -- automated E2E",
        signPublicKey: "oc-test-sign-key",
        encryptPublicKey: "oc-test-encrypt-key",
      }
    );
    expect(data.requestId).toBeTruthy();
    expect(data.refCode).toMatch(/^[A-Z0-9-]+$/);
    requestId = data.requestId;
    refCode = data.refCode;
  });

  test("2. Expert polls events/pending and sees the new_request event", async () => {
    const data = await apiGet<{
      events: Array<{ type: string; requestId: string }>;
    }>("/api/v1/events/pending", EXPERT_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.type).toBe("new_request");
  });

  test("3. Expert sends a response via message API", async () => {
    const data = await apiPost<{ success: boolean }>(
      `/api/v1/message/${requestId}`,
      { from: "expert", plaintext: "OC->OC test response" },
      EXPERT_HEADERS
    );
    expect(data.success).toBe(true);
  });

  test("4. Consumer polls and sees the response", async () => {
    const data = await apiGet<{
      events: Array<{ type: string; requestId: string; from: string }>;
    }>("/api/v1/events/pending", CONSUMER_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.type).toBe("new_message");
    expect(match?.from).toBe("expert");
  });

  test("5. Request status is responded", async () => {
    const data = await apiGet<{ requestId: string; status: string }>(
      `/api/v1/help/${requestId}`,
      CONSUMER_HEADERS
    );
    expect(data.status).toBe("responded");
  });
});
