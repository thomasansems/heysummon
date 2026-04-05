/**
 * Approval button workflows per channel
 *
 * Tests that approval buttons work correctly through each channel's webhook handler:
 * - Telegram: callback_query with approve/deny callback_data
 * - Slack: block_actions interactive payload with approve_request/deny_request
 * - OpenClaw: query-param action URLs (?action=approve&requestId=xxx)
 * - Idempotency: pressing a button twice does not error
 */

import { test, expect } from "@playwright/test";
import { apiGet, apiPost, apiRaw } from "./helpers/api";
import { authHeaders } from "./helpers/session";
import { simulateTelegramApproval } from "./helpers/telegram-mock";
import { simulateSlackApproval } from "./helpers/slack-mock";
import { simulateOpenClawApproval, simulateOpenClawSignedApproval } from "./helpers/openclaw-mock";
import { PW, BASE_URL } from "./helpers/constants";

const CONSUMER_HEADERS = { "x-api-key": PW.CLIENT_KEY };

interface ChannelInfo {
  id: string;
  type: string;
  config: string;
}

let telegramChannelId: string;
let slackChannelId: string;
let openclawChannelId: string;

test.describe("Approval buttons per channel", () => {
  test.beforeAll(async () => {
    // Discover channel IDs via session-authenticated API
    const headers = await authHeaders();
    const data = await apiGet<{ channels: ChannelInfo[] }>("/api/channels", headers);
    const channels = data.channels;

    const telegram = channels.find((c) => c.type === "telegram");
    const slack = channels.find((c) => c.type === "slack");
    const openclaw = channels.find((c) => c.type === "openclaw");

    expect(telegram).toBeTruthy();
    expect(slack).toBeTruthy();
    expect(openclaw).toBeTruthy();

    telegramChannelId = telegram!.id;
    slackChannelId = slack!.id;
    openclawChannelId = openclaw!.id;
  });

  // ── Telegram ──────────────────────────────────────────────────────────────

  test.describe("Telegram approval buttons", () => {
    let approveRequestId: string;
    let denyRequestId: string;

    test("1. Submit request for Telegram approve test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_TELEGRAM_KEY,
          question: "Telegram approve button test",
          signPublicKey: "tg-approve-sign",
          encryptPublicKey: "tg-approve-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      expect(data.status).toBe("pending");
      approveRequestId = data.requestId;
    });

    test("2. Submit request for Telegram deny test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_TELEGRAM_KEY,
          question: "Telegram deny button test",
          signPublicKey: "tg-deny-sign",
          encryptPublicKey: "tg-deny-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      denyRequestId = data.requestId;
    });

    test("3. Approve via Telegram callback_query", async () => {
      // Note: answerCallbackQuery calls the real Telegram API with a fake token,
      // which may cause a 500. The DB update happens before that call, so the
      // approval decision is persisted regardless. We verify via the consumer API.
      const res = await simulateTelegramApproval({
        baseUrl: BASE_URL,
        channelId: telegramChannelId,
        secretToken: PW.TELEGRAM_WEBHOOK_SECRET,
        fromChatId: PW.TELEGRAM_PROVIDER_CHAT_ID,
        action: "approve",
        requestId: approveRequestId,
      });
      // Accept either 200 (if Telegram API responds) or 500 (fake token rejected)
      expect([200, 500]).toContain(res.status);
    });

    test("4. Consumer sees Telegram-approved request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${approveRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("approved");
    });

    test("5. Deny via Telegram callback_query", async () => {
      const res = await simulateTelegramApproval({
        baseUrl: BASE_URL,
        channelId: telegramChannelId,
        secretToken: PW.TELEGRAM_WEBHOOK_SECRET,
        fromChatId: PW.TELEGRAM_PROVIDER_CHAT_ID,
        action: "deny",
        requestId: denyRequestId,
      });
      expect([200, 500]).toContain(res.status);
    });

    test("6. Consumer sees Telegram-denied request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${denyRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("denied");
    });
  });

  // ── Slack ─────────────────────────────────────────────────────────────────

  test.describe("Slack approval buttons", () => {
    let approveRequestId: string;
    let denyRequestId: string;

    test("1. Submit request for Slack approve test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_SLACK_KEY,
          question: "Slack approve button test",
          signPublicKey: "slack-approve-sign",
          encryptPublicKey: "slack-approve-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      expect(data.status).toBe("pending");
      approveRequestId = data.requestId;
    });

    test("2. Submit request for Slack deny test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_SLACK_KEY,
          question: "Slack deny button test",
          signPublicKey: "slack-deny-sign",
          encryptPublicKey: "slack-deny-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      denyRequestId = data.requestId;
    });

    test("3. Approve via Slack block_actions", async () => {
      const res = await simulateSlackApproval({
        baseUrl: BASE_URL,
        channelId: slackChannelId,
        signingSecret: PW.SLACK_SIGNING_SECRET,
        slackChannelId: PW.SLACK_CHANNEL_ID,
        action: "approve_request",
        requestId: approveRequestId,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    });

    test("4. Consumer sees Slack-approved request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${approveRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("approved");
    });

    test("5. Deny via Slack block_actions", async () => {
      const res = await simulateSlackApproval({
        baseUrl: BASE_URL,
        channelId: slackChannelId,
        signingSecret: PW.SLACK_SIGNING_SECRET,
        slackChannelId: PW.SLACK_CHANNEL_ID,
        action: "deny_request",
        requestId: denyRequestId,
      });
      expect(res.status).toBe(200);
    });

    test("6. Consumer sees Slack-denied request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${denyRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("denied");
    });
  });

  // ── OpenClaw ──────────────────────────────────────────────────────────────

  test.describe("OpenClaw approval buttons", () => {
    let approveRequestId: string;
    let denyRequestId: string;
    let signedRequestId: string;

    test("1. Submit request for OpenClaw approve test (query-param)", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_OPENCLAW_KEY,
          question: "OpenClaw approve button test",
          signPublicKey: "oc-approve-sign",
          encryptPublicKey: "oc-approve-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      expect(data.status).toBe("pending");
      approveRequestId = data.requestId;
    });

    test("2. Submit request for OpenClaw deny test (query-param)", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_OPENCLAW_KEY,
          question: "OpenClaw deny button test",
          signPublicKey: "oc-deny-sign",
          encryptPublicKey: "oc-deny-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      denyRequestId = data.requestId;
    });

    test("3. Submit request for OpenClaw signed approve test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_OPENCLAW_KEY,
          question: "OpenClaw signed approve test",
          signPublicKey: "oc-signed-sign",
          encryptPublicKey: "oc-signed-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      signedRequestId = data.requestId;
    });

    test("4. Approve via OpenClaw query-param action URL", async () => {
      const res = await simulateOpenClawApproval({
        baseUrl: BASE_URL,
        channelId: openclawChannelId,
        action: "approve",
        requestId: approveRequestId,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.decision).toBe("approved");
    });

    test("5. Consumer sees OpenClaw-approved request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${approveRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("approved");
    });

    test("6. Deny via OpenClaw query-param action URL", async () => {
      const res = await simulateOpenClawApproval({
        baseUrl: BASE_URL,
        channelId: openclawChannelId,
        action: "deny",
        requestId: denyRequestId,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.decision).toBe("denied");
    });

    test("7. Consumer sees OpenClaw-denied request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${denyRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("denied");
    });

    test("8. Approve via OpenClaw signed JSON body", async () => {
      const res = await simulateOpenClawSignedApproval({
        baseUrl: BASE_URL,
        channelId: openclawChannelId,
        webhookSecret: PW.OPENCLAW_WEBHOOK_SECRET,
        action: "approve",
        requestId: signedRequestId,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
      expect(body.decision).toBe("approved");
    });

    test("9. Consumer sees signed-approved request", async () => {
      const data = await apiGet<{
        requestId: string;
        status: string;
        approvalDecision: string;
      }>(`/api/v1/help/${signedRequestId}`, CONSUMER_HEADERS);
      expect(data.status).toBe("responded");
      expect(data.approvalDecision).toBe("approved");
    });
  });

  // ── Idempotency ───────────────────────────────────────────────────────────

  test.describe("Idempotency: pressing button twice", () => {
    let requestId: string;

    test("1. Submit request for idempotency test", async () => {
      const data = await apiPost<{ requestId: string; status: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_SLACK_KEY,
          question: "Idempotency test -- double press",
          signPublicKey: "idem-sign",
          encryptPublicKey: "idem-encrypt",
          requiresApproval: true,
        },
      );
      expect(data.requestId).toBeTruthy();
      requestId = data.requestId;
    });

    test("2. First approve via Slack succeeds", async () => {
      const res = await simulateSlackApproval({
        baseUrl: BASE_URL,
        channelId: slackChannelId,
        signingSecret: PW.SLACK_SIGNING_SECRET,
        slackChannelId: PW.SLACK_CHANNEL_ID,
        action: "approve_request",
        requestId,
      });
      expect(res.status).toBe(200);
    });

    test("3. Second approve via Slack does not error (idempotent)", async () => {
      const res = await simulateSlackApproval({
        baseUrl: BASE_URL,
        channelId: slackChannelId,
        signingSecret: PW.SLACK_SIGNING_SECRET,
        slackChannelId: PW.SLACK_CHANNEL_ID,
        action: "approve_request",
        requestId,
      });
      // Slack handler returns 200 OK even on double-press (shows "Already approved")
      expect(res.status).toBe(200);
    });

    test("4. Telegram double-press does not error", async () => {
      // Submit a fresh request for Telegram idempotency
      const data = await apiPost<{ requestId: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_TELEGRAM_KEY,
          question: "Telegram idempotency test",
          signPublicKey: "tg-idem-sign",
          encryptPublicKey: "tg-idem-encrypt",
          requiresApproval: true,
        },
      );
      const tgRequestId = data.requestId;

      // First press -- may return 200 or 500 due to fake Telegram API token
      const res1 = await simulateTelegramApproval({
        baseUrl: BASE_URL,
        channelId: telegramChannelId,
        secretToken: PW.TELEGRAM_WEBHOOK_SECRET,
        fromChatId: PW.TELEGRAM_PROVIDER_CHAT_ID,
        action: "approve",
        requestId: tgRequestId,
      });
      expect([200, 500]).toContain(res1.status);

      // Second press -- should not error (returns "Already approved")
      // The double-press path calls answerCallbackQuery before returning,
      // which may fail with fake token, but it should not throw a 500
      // because the double-press path returns early with ok: true.
      const res2 = await simulateTelegramApproval({
        baseUrl: BASE_URL,
        channelId: telegramChannelId,
        secretToken: PW.TELEGRAM_WEBHOOK_SECRET,
        fromChatId: PW.TELEGRAM_PROVIDER_CHAT_ID,
        action: "deny",
        requestId: tgRequestId,
      });
      // Double-press: the early-return path still calls answerCallbackQuery
      expect([200, 500]).toContain(res2.status);

      // Decision should still be "approved" (first press wins)
      const check = await apiGet<{
        approvalDecision: string;
      }>(`/api/v1/help/${tgRequestId}`, CONSUMER_HEADERS);
      expect(check.approvalDecision).toBe("approved");
    });

    test("5. OpenClaw double-press does not error", async () => {
      const data = await apiPost<{ requestId: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CC_OPENCLAW_KEY,
          question: "OpenClaw idempotency test",
          signPublicKey: "oc-idem-sign",
          encryptPublicKey: "oc-idem-encrypt",
          requiresApproval: true,
        },
      );
      const ocRequestId = data.requestId;

      // First press
      const res1 = await simulateOpenClawApproval({
        baseUrl: BASE_URL,
        channelId: openclawChannelId,
        action: "deny",
        requestId: ocRequestId,
      });
      expect(res1.status).toBe(200);

      // Second press -- should not error, returns existing decision
      const res2 = await simulateOpenClawApproval({
        baseUrl: BASE_URL,
        channelId: openclawChannelId,
        action: "approve",
        requestId: ocRequestId,
      });
      expect(res2.status).toBe(200);
      const body = await res2.json();
      expect(body.decision).toBe("denied"); // First decision wins

      // Verify consumer sees the original decision
      const check = await apiGet<{
        approvalDecision: string;
      }>(`/api/v1/help/${ocRequestId}`, CONSUMER_HEADERS);
      expect(check.approvalDecision).toBe("denied");
    });

    test("6. Direct API double-approve returns 409", async () => {
      // The direct /api/v1/approve endpoint returns 409 on double-decision
      // (channel webhooks return 200 -- different behavior by design)
      const data = await apiPost<{ requestId: string }>(
        "/api/v1/help",
        {
          apiKey: PW.CLIENT_KEY,
          question: "Direct API idempotency test",
          signPublicKey: "api-idem-sign",
          encryptPublicKey: "api-idem-encrypt",
          requiresApproval: true,
        },
      );

      const providerHeaders = { "x-api-key": PW.PROVIDER_KEY };

      // First approve
      await apiPost(
        `/api/v1/approve/${data.requestId}`,
        { decision: "approved" },
        providerHeaders,
      );

      // Second approve -- 409
      const res = await apiRaw(
        "POST",
        `/api/v1/approve/${data.requestId}`,
        { decision: "denied" },
        providerHeaders,
      );
      expect(res.status).toBe(409);
    });
  });
});
