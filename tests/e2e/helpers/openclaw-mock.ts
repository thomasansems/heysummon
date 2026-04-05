import crypto from "crypto";

/**
 * Simulates an OpenClaw approval callback via query-param action URL.
 * OpenClaw sends approve/deny by POSTing to the webhook with ?action=approve&requestId=xxx.
 */
export async function simulateOpenClawApproval({
  baseUrl,
  channelId,
  action,
  requestId,
}: {
  baseUrl: string;
  channelId: string;
  action: "approve" | "deny";
  requestId: string;
}): Promise<Response> {
  const url = `${baseUrl}/api/adapters/openclaw/${channelId}/webhook?action=${action}&requestId=${requestId}`;

  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
}

/**
 * Simulates an OpenClaw approval callback via signed JSON body.
 * Uses HMAC-SHA256 signature verification.
 */
export async function simulateOpenClawSignedApproval({
  baseUrl,
  channelId,
  webhookSecret,
  action,
  requestId,
}: {
  baseUrl: string;
  channelId: string;
  webhookSecret: string;
  action: "approve" | "deny";
  requestId: string;
}): Promise<Response> {
  const body = JSON.stringify({ action, requestId });
  const signature = crypto
    .createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");

  return fetch(`${baseUrl}/api/adapters/openclaw/${channelId}/webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-openclaw-signature": signature,
    },
    body,
  });
}
