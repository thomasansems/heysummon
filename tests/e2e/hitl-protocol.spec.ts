/**
 * HITL Protocol Lifecycle E2E Test
 *
 * Tests the full human-in-the-loop lifecycle with new protocol features:
 * state machine transitions, consumer rating, close with audit, and metrics.
 *
 * Runs across all channel combinations.
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost, apiRaw } from "./helpers/api";
import { PW } from "./helpers/constants";

const PROVIDER_HEADERS = { "x-api-key": PW.PROVIDER_KEY };

const CHANNEL_COMBOS = [
  { name: "OC→OC", consumerKey: PW.OC_OPENCLAW_KEY },
  { name: "OC→TG", consumerKey: PW.OC_TELEGRAM_KEY },
  { name: "CC→OC", consumerKey: PW.CC_OPENCLAW_KEY },
  { name: "CC→TG", consumerKey: PW.CC_TELEGRAM_KEY },
];

for (const { name, consumerKey } of CHANNEL_COMBOS) {
  test.describe(`HITL lifecycle: ${name}`, () => {
    const CONSUMER_HEADERS = { "x-api-key": consumerKey };
    let requestId: string;

    test("1. Submit request", async () => {
      const data = await apiPost<{
        requestId: string;
        refCode: string;
        status: string;
      }>("/api/v1/help", {
        apiKey: consumerKey,
        question: `HITL protocol test (${name}) — automated E2E`,
        signPublicKey: `hitl-${name}-sign-key`,
        encryptPublicKey: `hitl-${name}-encrypt-key`,
      });

      expect(data.requestId).toBeTruthy();
      expect(data.status).toBe("pending");
      requestId = data.requestId;
    });

    test("2. Provider sees request in events/pending", async () => {
      const data = await apiGet<{
        events: Array<{ type: string; requestId: string; escalated?: boolean }>;
      }>("/api/v1/events/pending", PROVIDER_HEADERS);

      const match = data.events.find((e) => e.requestId === requestId);
      expect(match).toBeTruthy();
      expect(match?.type).toBe("new_request");
      // New: escalated flag should be present (false for fresh requests)
      expect(match?.escalated).toBe(false);
    });

    test("3. Provider responds → status becomes responded", async () => {
      const data = await apiPost<{ success: boolean }>(
        `/api/v1/message/${requestId}`,
        { from: "provider", plaintext: `HITL response (${name})` },
        PROVIDER_HEADERS
      );
      expect(data.success).toBe(true);

      // Verify status transitioned via state machine
      const status = await apiGet<{ request: { status: string } }>(
        `/api/v1/help/${requestId}`,
        CONSUMER_HEADERS
      );
      expect(status.request.status).toBe("responded");
    });

    test("4. Consumer rates the response", async () => {
      const data = await apiPost<{ success: boolean; rating: number }>(
        `/api/v1/rate/${requestId}`,
        { rating: 4, feedback: `Good response for ${name} test` },
        CONSUMER_HEADERS
      );
      expect(data.success).toBe(true);
      expect(data.rating).toBe(4);
    });

    test("5. Re-rating returns 409 (idempotent)", async () => {
      const res = await apiRaw(
        "POST",
        `/api/v1/rate/${requestId}`,
        { rating: 5 },
        CONSUMER_HEADERS
      );
      expect(res.status).toBe(409);
    });

    test("6. Consumer closes the request", async () => {
      const data = await apiPost<{
        success: boolean;
        status: string;
        previousStatus?: string;
      }>(`/api/v1/close/${requestId}`, {}, CONSUMER_HEADERS);
      expect(data.success).toBe(true);
      expect(data.status).toBe("closed");
      expect(data.previousStatus).toBe("responded");
    });

    test("7. Re-closing is idempotent", async () => {
      const data = await apiPost<{ success: boolean; status: string }>(
        `/api/v1/close/${requestId}`,
        {},
        CONSUMER_HEADERS
      );
      expect(data.success).toBe(true);
      expect(data.status).toBe("closed");
    });
  });
}
