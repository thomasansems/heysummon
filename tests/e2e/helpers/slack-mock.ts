import crypto from "crypto";

export interface SlackSendMessagePayload {
  channel: string;
  text: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * Simulates a Slack Events API webhook callback (e.g. /reply HS-XXXX answer from expert).
 * Calls the local /api/adapters/slack/[id]/webhook endpoint directly.
 */
export async function simulateSlackReply({
  baseUrl,
  channelId,
  signingSecret,
  slackChannelId,
  userId,
  text,
}: {
  baseUrl: string;
  channelId: string;
  signingSecret: string;
  slackChannelId: string;
  userId?: string;
  text: string;
}): Promise<Response> {
  const event = {
    type: "event_callback",
    token: "test-token",
    team_id: "T00PW00TEST",
    event: {
      type: "message",
      channel: slackChannelId,
      user: userId ?? "U00PW00USER",
      text,
      ts: String(Date.now() / 1000),
    },
  };

  const rawBody = JSON.stringify(event);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const signature = `v0=${hmac}`;

  return fetch(`${baseUrl}/api/adapters/slack/${channelId}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    body: rawBody,
  });
}

/**
 * Simulates a Slack Block Kit button press (block_actions interactive payload).
 * Used to test approve/deny button flows.
 */
export async function simulateSlackApproval({
  baseUrl,
  channelId,
  signingSecret,
  slackChannelId,
  action,
  requestId,
}: {
  baseUrl: string;
  channelId: string;
  signingSecret: string;
  slackChannelId: string;
  action: "approve_request" | "deny_request";
  requestId: string;
}): Promise<Response> {
  const payload = {
    type: "block_actions",
    user: { id: "U00PW00USER", username: "testprovider" },
    actions: [
      {
        action_id: action,
        value: requestId,
      },
    ],
    channel: { id: slackChannelId },
    message: {
      ts: String(Date.now() / 1000),
      text: `Approval required`,
    },
    container: {
      channel_id: slackChannelId,
      message_ts: String(Date.now() / 1000),
    },
  };

  const rawBody = `payload=${encodeURIComponent(JSON.stringify(payload))}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const signature = `v0=${hmac}`;

  return fetch(`${baseUrl}/api/adapters/slack/${channelId}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    body: rawBody,
  });
}

/**
 * Simulates the Slack URL verification challenge.
 * Calls the webhook endpoint with a url_verification payload.
 */
export async function simulateSlackUrlVerification({
  baseUrl,
  channelId,
  signingSecret,
  challenge,
}: {
  baseUrl: string;
  channelId: string;
  signingSecret: string;
  challenge?: string;
}): Promise<Response> {
  const payload = {
    type: "url_verification",
    token: "test-token",
    challenge: challenge ?? "test_challenge_string",
  };

  const rawBody = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const baseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const signature = `v0=${hmac}`;

  return fetch(`${baseUrl}/api/adapters/slack/${channelId}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-slack-request-timestamp": timestamp,
      "x-slack-signature": signature,
    },
    body: rawBody,
  });
}
