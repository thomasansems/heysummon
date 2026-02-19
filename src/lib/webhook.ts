import { createHmac } from "node:crypto";
import { encryptMessage } from "./crypto";
import { prisma } from "./prisma";

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [0, 5000, 15000]; // immediate, 5s, 15s

interface WebhookPayload {
  requestId: string;
  refCode: string | null;
  status: string;
  response: string; // Encrypted with consumer's public key
  respondedAt: string;
}

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
function signPayload(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/**
 * Deliver a response to the consumer's webhook URL.
 * The response is encrypted with the consumer's public key before sending.
 * The payload is signed with HMAC-SHA256 using the webhook secret.
 */
export async function deliverWebhook(requestId: string): Promise<boolean> {
  const helpRequest = await prisma.helpRequest.findUnique({
    where: { id: requestId },
  });

  if (!helpRequest || !helpRequest.response || !helpRequest.webhookUrl) {
    console.error(`Webhook delivery: request ${requestId} not found or no response`);
    return false;
  }

  // Encrypt the response with consumer's public key
  const encryptedResponse = encryptMessage(
    helpRequest.response,
    helpRequest.consumerPublicKey
  );

  const payload: WebhookPayload = {
    requestId: helpRequest.id,
    refCode: helpRequest.refCode,
    status: "responded",
    response: encryptedResponse,
    respondedAt: helpRequest.respondedAt?.toISOString() || new Date().toISOString(),
  };

  const payloadStr = JSON.stringify(payload);
  const signature = helpRequest.webhookSecret
    ? signPayload(payloadStr, helpRequest.webhookSecret)
    : undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-HITLaaS-Event": "response.delivered",
        "X-HITLaaS-Request-Id": helpRequest.id,
      };

      if (signature) {
        headers["X-HITLaaS-Signature"] = `sha256=${signature}`;
      }

      const res = await fetch(helpRequest.webhookUrl, {
        method: "POST",
        headers,
        body: payloadStr,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.ok) {
        await prisma.helpRequest.update({
          where: { id: requestId },
          data: {
            webhookDelivered: true,
            webhookAttempts: attempt + 1,
            webhookLastError: null,
          },
        });
        return true;
      }

      const errorText = `HTTP ${res.status}: ${await res.text().catch(() => "")}`;
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: {
          webhookAttempts: attempt + 1,
          webhookLastError: errorText,
        },
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await prisma.helpRequest.update({
        where: { id: requestId },
        data: {
          webhookAttempts: attempt + 1,
          webhookLastError: errorMsg,
        },
      });
    }
  }

  return false;
}
