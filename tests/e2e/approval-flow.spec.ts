/**
 * Approval flow E2E test
 *
 * Tests the requiresApproval workflow with HITL audit logging.
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost, apiRaw } from "./helpers/api";
import { PW } from "./helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.CLIENT_KEY };
const PROVIDER_HEADERS = { "x-api-key": PW.PROVIDER_KEY };

test.describe("Approval workflow", () => {
  let approveRequestId: string;
  let denyRequestId: string;

  test("1. Submit request with requiresApproval=true (for approval)", async () => {
    const data = await apiPost<{ requestId: string; status: string }>(
      "/api/v1/help",
      {
        apiKey: PW.CLIENT_KEY,
        question: "Approval flow test — approve case",
        signPublicKey: "approval-test-sign",
        encryptPublicKey: "approval-test-encrypt",
        requiresApproval: true,
      }
    );
    expect(data.requestId).toBeTruthy();
    expect(data.status).toBe("pending");
    approveRequestId = data.requestId;
  });

  test("2. Submit request with requiresApproval=true (for denial)", async () => {
    const data = await apiPost<{ requestId: string; status: string }>(
      "/api/v1/help",
      {
        apiKey: PW.CLIENT_KEY,
        question: "Approval flow test — deny case",
        signPublicKey: "denial-test-sign",
        encryptPublicKey: "denial-test-encrypt",
        requiresApproval: true,
      }
    );
    expect(data.requestId).toBeTruthy();
    denyRequestId = data.requestId;
  });

  test("3. Provider approves first request", async () => {
    const data = await apiPost<{ success: boolean; decision: string }>(
      `/api/v1/approve/${approveRequestId}`,
      { decision: "approved" },
      PROVIDER_HEADERS
    );
    expect(data.success).toBe(true);
    expect(data.decision).toBe("approved");
  });

  test("4. Approved request status is responded", async () => {
    const data = await apiGet<{
      requestId: string; status: string; approvalDecision: string;
    }>(`/api/v1/help/${approveRequestId}`, CONSUMER_HEADERS);
    expect(data.status).toBe("responded");
    expect(data.approvalDecision).toBe("approved");
  });

  test("5. Re-approving returns 409 (already decided)", async () => {
    const res = await apiRaw(
      "POST",
      `/api/v1/approve/${approveRequestId}`,
      { decision: "denied" },
      PROVIDER_HEADERS
    );
    expect(res.status).toBe(409);
  });

  test("6. Provider denies second request", async () => {
    const data = await apiPost<{ success: boolean; decision: string }>(
      `/api/v1/approve/${denyRequestId}`,
      { decision: "denied" },
      PROVIDER_HEADERS
    );
    expect(data.success).toBe(true);
    expect(data.decision).toBe("denied");
  });

  test("7. Denied request has correct decision", async () => {
    const data = await apiGet<{
      requestId: string; status: string; approvalDecision: string;
    }>(`/api/v1/help/${denyRequestId}`, CONSUMER_HEADERS);
    expect(data.status).toBe("responded");
    expect(data.approvalDecision).toBe("denied");
  });
});
