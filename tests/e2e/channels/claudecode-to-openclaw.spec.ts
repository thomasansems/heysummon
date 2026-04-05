/**
 * Channel combination 3: Claude Code consumer -> OpenClaw expert notification.
 *
 * Consumer submits with clientChannel=claudecode, using Ed25519 + X25519 public
 * keys in the request body. The consumer polls /api/v1/help/[id] directly
 * (not events/pending), but the expert still sees it via events/pending.
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost } from "../helpers/api";
import { PW } from "../helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.CC_OPENCLAW_KEY };
const EXPERT_HEADERS = { "x-api-key": PW.EXPERT_KEY };

/** Simulate Ed25519 SPKI PEM format */
const MOCK_SIGN_KEY = "MCowBQYDK2VwAyEAtest_sign_key_base64_encoded_0000000000";
const MOCK_ENCRYPT_KEY = "MCowBQYDK2VuAyEAtest_encrypt_key_base64_encoded_00000";

test.describe("Channel: Claude Code consumer -> OpenClaw expert (polling)", () => {
  let requestId: string;
  let refCode: string;

  test("1. Consumer submits request with E2E keys (claudecode channel)", async () => {
    const data = await apiPost<{
      requestId: string;
      refCode: string;
      status: string;
    }>("/api/v1/help", {
      apiKey: PW.CC_OPENCLAW_KEY,
      question: "CC->OC channel test -- automated E2E",
      signPublicKey: MOCK_SIGN_KEY,
      encryptPublicKey: MOCK_ENCRYPT_KEY,
    });

    expect(data.requestId).toBeTruthy();
    expect(data.refCode).toMatch(/^[A-Z0-9-]+$/);
    expect(data.status).toBe("pending");

    requestId = data.requestId;
    refCode = data.refCode;
  });

  test("2. Platform stores the consumer Ed25519/X25519 public keys on the request", async () => {
    // Keys are visible via the expert's events/pending endpoint
    const data = await apiGet<{
      events: Array<{
        type: string;
        requestId: string;
        consumerSignPubKey: string | null;
        consumerEncryptPubKey: string | null;
      }>;
    }>("/api/v1/events/pending", EXPERT_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.consumerSignPubKey).toBe(MOCK_SIGN_KEY);
    expect(match?.consumerEncryptPubKey).toBe(MOCK_ENCRYPT_KEY);
  });

  test("3. Expert polls events/pending and sees the request", async () => {
    const data = await apiGet<{
      events: Array<{
        type: string;
        requestId: string;
        consumerSignPubKey: string | null;
        consumerEncryptPubKey: string | null;
      }>;
    }>("/api/v1/events/pending", EXPERT_HEADERS);

    const match = data.events.find((e) => e.requestId === requestId);
    expect(match).toBeTruthy();
    expect(match?.type).toBe("new_request");
    // Expert receives the consumer's public keys so they can set up E2E encryption
    expect(match?.consumerSignPubKey).toBeTruthy();
  });

  test("4. Expert responds", async () => {
    const data = await apiPost<{ success: boolean }>(
      `/api/v1/message/${requestId}`,
      { from: "expert", plaintext: "CC->OC test response" },
      EXPERT_HEADERS
    );
    expect(data.success).toBe(true);
  });

  test("5. Consumer polls /api/v1/help/[requestId] directly (not events/pending)", async () => {
    // The consumer SDK polls this endpoint directly (not events/pending)
    const data = await apiGet<{
      requestId: string; status: string; refCode: string;
    }>(`/api/v1/help/${requestId}`, CONSUMER_HEADERS);

    expect(data.status).toBe("responded");
    expect(data.refCode).toBe(refCode);
  });
});
