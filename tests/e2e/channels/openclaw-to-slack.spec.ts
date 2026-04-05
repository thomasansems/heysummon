/**
 * Channel combination 5: OpenClaw consumer -> Slack expert notification.
 *
 * When a consumer submits a request with an API key linked to an expert
 * that has a Slack channel configured, the platform should:
 * 1. Send a Slack notification to the expert's configured channel
 * 2. Allow the expert to respond via the /api/v1/message endpoint
 * 3. Allow the consumer to poll and receive the response
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost } from "../helpers/api";
import { PW } from "../helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.OC_SLACK_KEY };
const EXPERT_HEADERS = { "x-api-key": PW.EXPERT_KEY };

test.describe("Channel: OpenClaw consumer -> Slack expert notification", () => {
  let requestId: string;
  let refCode: string;

  test("1. Submit request creates help request successfully", async () => {
    const data = await apiPost<{ requestId: string; refCode: string }>(
      "/api/v1/help",
      {
        apiKey: PW.OC_SLACK_KEY,
        question: "OC->Slack channel test -- automated E2E",
        signPublicKey: "oc-slack-test-sign-key",
        encryptPublicKey: "oc-slack-test-encrypt-key",
      },
    );
    requestId = data.requestId;
    refCode = data.refCode;

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
      { from: "expert", plaintext: "OC->Slack test response" },
      EXPERT_HEADERS,
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
